import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { Loader2, MapPin, AlertCircle, Navigation, Clock, Compass, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface DriverMapViewProps {
  onOrderSelect?: (order: Order) => void;
}

interface RouteInfo {
  duration: string;
  distance: string;
  durationValue: number;
  distanceValue: number;
}

type GeoZone = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

interface OrderWithCoords extends Order {
  drivingDistance?: number;
  drivingDuration?: number;
}

// Toronto city center coordinates
const CITY_CENTER_LAT = 43.6532;
const CITY_CENTER_LNG = -79.3832;

// Determine geo zone based on coordinates
function determineGeoZone(lat: number, lng: number): GeoZone {
  if (lat > CITY_CENTER_LAT) {
    return 'NORTH';
  } else if (lat < CITY_CENTER_LAT) {
    return 'SOUTH';
  } else if (lng > CITY_CENTER_LNG) {
    return 'EAST';
  } else {
    return 'WEST';
  }
}

export function DriverMapView({ onOrderSelect }: DriverMapViewProps) {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const driverMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderWithCoords[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithCoords[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithCoords | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [selectedZone, setSelectedZone] = useState<GeoZone | null>(null);
  const [driverZone, setDriverZone] = useState<GeoZone | null>(null);
  const [zoneCounts, setZoneCounts] = useState<Record<GeoZone, number>>({ NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 });
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [activeDestination, setActiveDestination] = useState<OrderWithCoords | null>(null);

  // Fetch Google Maps API key
  const fetchApiKey = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      if (error) throw error;
      return data.apiKey;
    } catch (err) {
      console.error('Error fetching Google Maps API key:', err);
      throw new Error('Failed to load map configuration');
    }
  }, []);

  // Fetch driver's orders
  const fetchOrders = useCallback(async () => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('assigned_driver_id', user.id)
        .not('timeline_status', 'in', '("COMPLETED_DELIVERED","COMPLETED_INCOMPLETE")')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as OrderWithCoords[];
    } catch (err) {
      console.error('Error fetching orders:', err);
      return [];
    }
  }, [user]);

  // Geocode address and determine zone
  const geocodeAndSetZone = useCallback(async (
    order: OrderWithCoords, 
    geocoder: google.maps.Geocoder
  ): Promise<OrderWithCoords> => {
    // If already geocoded, return as-is
    if (order.latitude && order.longitude) {
      return order;
    }

    const address = [
      order.address_1,
      order.city,
      order.province,
      order.postal,
      order.country || 'Canada'
    ].filter(Boolean).join(', ');

    if (!address) return order;

    try {
      const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results) {
            resolve(results);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });

      if (result.length > 0) {
        const location = result[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        const geoZone = determineGeoZone(lat, lng);

        // Update order in database
        await supabase
          .from('orders')
          .update({ latitude: lat, longitude: lng, geo_zone: geoZone })
          .eq('id', order.id);

        return {
          ...order,
          latitude: lat,
          longitude: lng,
          geo_zone: geoZone
        };
      }
    } catch (err) {
      console.error('Geocoding error for order:', order.id, err);
    }

    return order;
  }, []);

  // Calculate distances using Distance Matrix API
  const calculateDistances = useCallback(async (
    origin: { lat: number; lng: number },
    ordersToCalculate: OrderWithCoords[]
  ): Promise<OrderWithCoords[]> => {
    if (!googleMapsLoaded || ordersToCalculate.length === 0) return ordersToCalculate;

    const destinations = ordersToCalculate
      .filter(o => o.latitude && o.longitude)
      .map(o => new google.maps.LatLng(o.latitude!, o.longitude!));

    if (destinations.length === 0) return ordersToCalculate;

    try {
      const service = new google.maps.DistanceMatrixService();
      const result = await new Promise<google.maps.DistanceMatrixResponse>((resolve, reject) => {
        service.getDistanceMatrix({
          origins: [new google.maps.LatLng(origin.lat, origin.lng)],
          destinations,
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS
          }
        }, (response, status) => {
          if (status === 'OK' && response) {
            resolve(response);
          } else {
            reject(new Error(`Distance Matrix failed: ${status}`));
          }
        });
      });

      const elements = result.rows[0]?.elements || [];
      let elementIndex = 0;

      return ordersToCalculate.map(order => {
        if (order.latitude && order.longitude) {
          const element = elements[elementIndex++];
          if (element?.status === 'OK') {
            return {
              ...order,
              drivingDistance: element.distance?.value || 0,
              drivingDuration: element.duration_in_traffic?.value || element.duration?.value || 0
            };
          }
        }
        return order;
      }).sort((a, b) => (a.drivingDistance || Infinity) - (b.drivingDistance || Infinity));
    } catch (err) {
      console.error('Distance calculation error:', err);
      return ordersToCalculate;
    }
  }, [googleMapsLoaded]);

  // Draw route to destination
  const drawRoute = useCallback(async (destination: OrderWithCoords) => {
    if (!mapRef.current || !driverLocation || !destination.latitude || !destination.longitude) return;

    setIsLoadingRoute(true);
    setRouteInfo(null);

    try {
      const directionsService = new google.maps.DirectionsService();
      
      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map: mapRef.current,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#f97316',
            strokeWeight: 5,
            strokeOpacity: 0.85
          }
        });
      }

      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route({
          origin: new google.maps.LatLng(driverLocation.lat, driverLocation.lng),
          destination: new google.maps.LatLng(destination.latitude!, destination.longitude!),
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS
          }
        }, (response, status) => {
          if (status === 'OK' && response) {
            resolve(response);
          } else {
            reject(new Error(`Directions failed: ${status}`));
          }
        });
      });

      directionsRendererRef.current.setDirections(result);

      const route = result.routes[0];
      const leg = route.legs[0];

      setRouteInfo({
        duration: leg.duration_in_traffic?.text || leg.duration?.text || '',
        distance: leg.distance?.text || '',
        durationValue: leg.duration_in_traffic?.value || leg.duration?.value || 0,
        distanceValue: leg.distance?.value || 0
      });

      setActiveDestination(destination);
      setSelectedOrder(destination);

    } catch (err) {
      console.error('Route error:', err);
      toast.error('Failed to calculate route');
    } finally {
      setIsLoadingRoute(false);
    }
  }, [driverLocation]);

  // Clear route
  const clearRoute = useCallback(() => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] } as any);
    }
    setRouteInfo(null);
    setActiveDestination(null);
    setSelectedOrder(null);
  }, []);

  // Update markers on map
  const updateMarkers = useCallback((ordersToShow: OrderWithCoords[]) => {
    if (!mapRef.current || !googleMapsLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.map = null);
    markersRef.current = [];

    // Add markers for each order
    ordersToShow.forEach((order, index) => {
      if (!order.latitude || !order.longitude) return;

      // Create custom marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'order-marker';
      markerEl.style.cssText = `
        width: 36px;
        height: 36px;
        background-color: #000000;
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
      `;
      markerEl.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
        ${activeDestination?.id === order.id ? '' : `<span style="position:absolute;top:-8px;right:-8px;background:#f97316;color:white;border-radius:50%;width:20px;height:20px;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:bold;">${index + 1}</span>`}
      `;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!,
        position: { lat: order.latitude, lng: order.longitude },
        content: markerEl,
        title: order.name || 'Delivery'
      });

      markerEl.addEventListener('click', () => {
        drawRoute(order);
      });

      markersRef.current.push(marker);
    });
  }, [googleMapsLoaded, activeDestination, drawRoute]);

  // Update driver marker
  const updateDriverMarker = useCallback((location: { lat: number; lng: number }) => {
    if (!mapRef.current || !googleMapsLoaded) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.position = location;
      return;
    }

    // Create driver marker element
    const driverEl = document.createElement('div');
    driverEl.style.cssText = `
      width: 20px;
      height: 20px;
      background-color: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
    `;

    driverMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current,
      position: location,
      content: driverEl,
      title: 'Your Location'
    });
  }, [googleMapsLoaded]);

  // Watch driver location
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setDriverLocation(location);
        setDriverZone(determineGeoZone(location.lat, location.lng));
        updateDriverMarker(location);
      },
      (error) => {
        console.error('Location error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  }, [updateDriverMarker]);

  // Handle zone selection
  const handleZoneSelect = useCallback(async (zone: GeoZone) => {
    setSelectedZone(zone);
    
    const zoneOrders = orders.filter(o => o.geo_zone === zone);
    
    if (driverLocation && zoneOrders.length > 0) {
      const sortedOrders = await calculateDistances(driverLocation, zoneOrders);
      setFilteredOrders(sortedOrders);
      updateMarkers(sortedOrders);
      
      // Auto-draw route to closest delivery
      if (sortedOrders.length > 0 && sortedOrders[0].latitude && sortedOrders[0].longitude) {
        drawRoute(sortedOrders[0]);
      }
    } else {
      setFilteredOrders(zoneOrders);
      updateMarkers(zoneOrders);
    }
  }, [orders, driverLocation, calculateDistances, updateMarkers, drawRoute]);

  // Initialize map
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapContainer.current) return;

      try {
        setIsLoading(true);
        setError(null);

        const apiKey = await fetchApiKey();
        
        // Set Google Maps API options
        setOptions({
          key: apiKey,
          v: 'weekly',
        });

        // Load required libraries
        await importLibrary('maps');
        await importLibrary('marker');
        await importLibrary('geometry');
        if (!isMounted) return;

        setGoogleMapsLoaded(true);

        // Get initial location
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000
          });
        }).catch(() => null);

        const initialLocation = position 
          ? { lat: position.coords.latitude, lng: position.coords.longitude }
          : { lat: CITY_CENTER_LAT, lng: CITY_CENTER_LNG };

        if (!isMounted) return;
        setDriverLocation(initialLocation);
        setDriverZone(determineGeoZone(initialLocation.lat, initialLocation.lng));

        // Create map
        const mapId = 'driver-map';
        mapRef.current = new google.maps.Map(mapContainer.current, {
          center: initialLocation,
          zoom: 12,
          mapId,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true
        });

        // Fetch and geocode orders
        const fetchedOrders = await fetchOrders();
        if (!isMounted) return;

        const geocoder = new google.maps.Geocoder();
        const geocodedOrders = await Promise.all(
          fetchedOrders.map(order => geocodeAndSetZone(order, geocoder))
        );

        if (!isMounted) return;
        setOrders(geocodedOrders);

        // Calculate zone counts
        const counts: Record<GeoZone, number> = { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 };
        geocodedOrders.forEach(order => {
          if (order.geo_zone && counts.hasOwnProperty(order.geo_zone)) {
            counts[order.geo_zone as GeoZone]++;
          }
        });
        setZoneCounts(counts);

        // Auto-select driver's zone
        const dZone = determineGeoZone(initialLocation.lat, initialLocation.lng);
        if (counts[dZone] > 0) {
          handleZoneSelect(dZone);
        }

        // Start tracking location
        startLocationTracking();

        setIsLoading(false);

      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load map');
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      markersRef.current.forEach(marker => marker.map = null);
      if (driverMarkerRef.current) {
        driverMarkerRef.current.map = null;
      }
    };
  }, [fetchApiKey, fetchOrders, geocodeAndSetZone, startLocationTracking]);

  // Recalculate route when driver location changes significantly
  useEffect(() => {
    if (activeDestination && driverLocation) {
      // Only recalculate if driver moved more than 100 meters
      const threshold = 0.001; // roughly 100m
      const prevPos = directionsRendererRef.current?.getDirections()?.routes[0]?.legs[0]?.start_location;
      if (prevPos) {
        const latDiff = Math.abs(prevPos.lat() - driverLocation.lat);
        const lngDiff = Math.abs(prevPos.lng() - driverLocation.lng);
        if (latDiff > threshold || lngDiff > threshold) {
          drawRoute(activeDestination);
        }
      }
    }
  }, [driverLocation, activeDestination, drawRoute]);

  // Handle delivery completion - advance to next
  const handleDeliveryComplete = useCallback(async () => {
    if (!activeDestination) return;

    // Remove completed order from list
    const remainingOrders = filteredOrders.filter(o => o.id !== activeDestination.id);
    setFilteredOrders(remainingOrders);
    updateMarkers(remainingOrders);

    // Auto-advance to next
    if (remainingOrders.length > 0) {
      const nextOrder = remainingOrders[0];
      drawRoute(nextOrder);
      toast.success('Route updated to next delivery');
    } else {
      clearRoute();
      toast.success('All deliveries in this zone completed!');
    }
  }, [activeDestination, filteredOrders, updateMarkers, drawRoute, clearRoute]);

  // Recenter map on driver
  const recenterOnDriver = useCallback(() => {
    if (mapRef.current && driverLocation) {
      mapRef.current.panTo(driverLocation);
      mapRef.current.setZoom(15);
    }
  }, [driverLocation]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Map Error</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="absolute inset-0" />

      {/* Zone Selection */}
      <div className="absolute top-4 left-4 right-4 z-10 space-y-2">
        <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Compass className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Delivery Zones</span>
              {driverZone && (
                <Badge variant="outline" className="text-xs">
                  You're in {driverZone}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['NORTH', 'SOUTH', 'EAST', 'WEST'] as GeoZone[]).map((zone) => (
                <Button
                  key={zone}
                  variant={selectedZone === zone ? 'default' : 'outline'}
                  size="sm"
                  className="flex flex-col h-auto py-2"
                  onClick={() => handleZoneSelect(zone)}
                  disabled={zoneCounts[zone] === 0}
                >
                  <span className="text-xs font-medium">{zone}</span>
                  <span className="text-lg font-bold">{zoneCounts[zone]}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Delivery count */}
        {selectedZone && (
          <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm shadow-md">
            <MapPin className="w-3 h-3 mr-1" />
            {filteredOrders.length} {filteredOrders.length === 1 ? 'delivery' : 'deliveries'} in {selectedZone}
          </Badge>
        )}
      </div>

      {/* Route info + Directions panel */}
      {(routeInfo || isLoadingRoute) && (
        <div className="absolute top-36 left-4 right-4 z-10">
          <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-3">
              {isLoadingRoute ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Calculating route...</span>
                </div>
              ) : routeInfo && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        {routeInfo.duration}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {routeInfo.distance}
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-xs"
                    onClick={clearRoute}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recenter button */}
      <div className="absolute top-36 right-4 z-10" style={{ marginTop: (routeInfo || isLoadingRoute) ? '0' : '0' }}>
        {!routeInfo && !isLoadingRoute && (
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm"
            onClick={recenterOnDriver}
          >
            <Compass className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Delivery queue list */}
      {selectedZone && filteredOrders.length > 0 && !selectedOrder && (
        <div className="absolute bottom-4 left-4 right-4 z-10 max-h-48 overflow-y-auto">
          <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                Sorted by closest (with traffic)
              </p>
              {filteredOrders.slice(0, 5).map((order, index) => (
                <button
                  key={order.id}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  onClick={() => drawRoute(order)}
                >
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {order.city}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {order.address_1}
                    </p>
                  </div>
                  {order.drivingDuration && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(order.drivingDuration / 60)} min
                    </span>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selected order card */}
      {selectedOrder && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.city}, {selectedOrder.province}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedOrder.postal}
                  </p>
                </div>
                <Badge 
                  variant="secondary"
                  className={
                    selectedOrder.timeline_status === 'IN_ROUTE' ? 'bg-amber-100 text-amber-800' :
                    selectedOrder.timeline_status === 'CONFIRMED' ? 'bg-indigo-100 text-indigo-800' :
                    'bg-blue-100 text-blue-800'
                  }
                >
                  {selectedOrder.timeline_status?.replace(/_/g, ' ') || 'Pending'}
                </Badge>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => navigate(`/driver-navigation?orderId=${selectedOrder.id}`)}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Start Navigation
                </Button>
                <Button 
                  variant="outline"
                  size="sm" 
                  onClick={() => {
                    onOrderSelect?.(selectedOrder);
                  }}
                >
                  Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
