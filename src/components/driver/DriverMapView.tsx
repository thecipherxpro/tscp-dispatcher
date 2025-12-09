import { useEffect, useRef, useState, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order, TimelineStatus } from '@/types/auth';
import { updateOrderStatus } from '@/hooks/useOrders';
import { fetchDriverLocationData } from '@/hooks/useDriverLocation';
import { generateRouteSnapshot } from '@/hooks/useRouteSnapshot';
import { Loader2, MapPin, AlertCircle, Navigation, Clock, Compass, Play, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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

// Uber-style map styling - muted with visible parks and blue highways
const UBER_MAP_STYLE: google.maps.MapTypeStyle[] = [
  // Base map - light grey-white with subtle tint
  { elementType: 'geometry', stylers: [{ color: '#f0f2f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  
  // Administrative - show neighborhood labels in muted blue-grey
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#7a8ea3' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb0' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  
  // POIs - hide business icons but show park geometry
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d4e8d4' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  
  // Landscape - very light grey
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f0f2f5' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#f0f2f5' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e8ecf0' }] },
  
  // Roads - clean hierarchy
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  
  // Local roads - white with subtle stroke
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#e0e4e8' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9ca8b8' }] },
  
  // Arterial roads - white
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#d8dce0' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#8090a4' }] },
  
  // Highways - blue-grey like Uber
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#a8b8cc' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#8898b0' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#5a6a7c' }] },
  { featureType: 'road.highway', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry.fill', stylers: [{ color: '#99a8bc' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry.stroke', stylers: [{ color: '#7888a0' }] },
  
  // Hide transit
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  
  // Water - soft blue
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c8dce8' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const DELIVERY_OUTCOMES = {
  delivered: [
    { value: 'SUCCESSFULLY_DELIVERED', label: 'Successfully Delivered' },
    { value: 'PACKAGE_DELIVERED_TO_CLIENT', label: 'Package Delivered to Client' },
  ],
  incomplete: [
    { value: 'CLIENT_UNAVAILABLE', label: 'Client Unavailable' },
    { value: 'NO_ONE_HOME', label: 'No One Home' },
    { value: 'WRONG_ADDRESS', label: 'Wrong Address' },
    { value: 'ADDRESS_INCORRECT', label: 'Address Incorrect' },
    { value: 'UNSAFE_LOCATION', label: 'Unsafe Location' },
    { value: 'OTHER', label: 'Other' },
  ],
};

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
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
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
  
  // Delivery outcome state
  const [showOutcomeSheet, setShowOutcomeSheet] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'delivered' | 'incomplete' | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingDeliveryOrder, setPendingDeliveryOrder] = useState<OrderWithCoords | null>(null);
  const [showNextDeliveryCard, setShowNextDeliveryCard] = useState(false);
  const [nextDeliveryOrder, setNextDeliveryOrder] = useState<OrderWithCoords | null>(null);

  // Track when user leaves/returns to detect return from Google Maps
  const navigationStartedRef = useRef<string | null>(null);
  // Store driver's start location when navigation begins for route snapshot
  const driverStartLocationRef = useRef<{ lat: number; lng: number } | null>(null);

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
            strokeColor: '#F97316', // Orange
            strokeWeight: 6,
            strokeOpacity: 1,
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
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add markers for each order
    ordersToShow.forEach((order, index) => {
      if (!order.latitude || !order.longitude) return;

      const isActive = activeDestination?.id === order.id;
      
      const marker = new google.maps.Marker({
        map: mapRef.current!,
        position: { lat: order.latitude, lng: order.longitude },
        title: order.name || 'Delivery',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#000000',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        label: isActive ? undefined : {
          text: String(index + 1),
          color: '#F97316',
          fontSize: '11px',
          fontWeight: 'bold',
        },
      });

      google.maps.event.addListener(marker, 'click', () => {
        drawRoute(order);
      });

      markersRef.current.push(marker);
    });
  }, [googleMapsLoaded, activeDestination, drawRoute]);

  // Update driver marker
  const updateDriverMarker = useCallback((location: { lat: number; lng: number }) => {
    if (!mapRef.current || !googleMapsLoaded) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition(location);
      return;
    }

    driverMarkerRef.current = new google.maps.Marker({
      map: mapRef.current,
      position: location,
      title: 'Your Location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
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

  // Set order to CONFIRMED and SHIPPED status
  const setConfirmedAndShippedStatus = useCallback(async (orderData: OrderWithCoords) => {
    if (orderData.timeline_status === 'IN_ROUTE') return;

    try {
      const locationData = await fetchDriverLocationData();
      
      // First set to CONFIRMED if not already
      if (!['CONFIRMED', 'IN_ROUTE'].includes(orderData.timeline_status || '')) {
        await updateOrderStatus(
          orderData.id,
          orderData.tracking_id || null,
          'CONFIRMED' as TimelineStatus,
          undefined,
          {
            ip_address: locationData.ip_address,
            geolocation: locationData.geolocation,
            access_location: locationData.access_location
          }
        );
      }

      // Then set to SHIPPED (IN_ROUTE)
      await updateOrderStatus(
        orderData.id,
        orderData.tracking_id || null,
        'IN_ROUTE' as TimelineStatus,
        undefined,
        {
          ip_address: locationData.ip_address,
          geolocation: locationData.geolocation,
          access_location: locationData.access_location
        }
      );

      // Update local state
      setOrders(prev => prev.map(o => 
        o.id === orderData.id ? { ...o, timeline_status: 'IN_ROUTE' as TimelineStatus } : o
      ));
      setFilteredOrders(prev => prev.map(o => 
        o.id === orderData.id ? { ...o, timeline_status: 'IN_ROUTE' as TimelineStatus } : o
      ));
      if (selectedOrder?.id === orderData.id) {
        setSelectedOrder(prev => prev ? { ...prev, timeline_status: 'IN_ROUTE' as TimelineStatus } : null);
      }

      toast.success('Order confirmed and shipped');
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update order status');
    }
  }, [selectedOrder]);

  // Start navigation - confirm, ship, and open external Google Maps
  const handleStartNavigation = useCallback(async (order: OrderWithCoords) => {
    if (!order.latitude || !order.longitude) {
      toast.error('Order location not available');
      return;
    }

    // Store driver's current location for route snapshot when delivery completes
    if (driverLocation) {
      driverStartLocationRef.current = { ...driverLocation };
      console.log('Stored driver start location for snapshot:', driverStartLocationRef.current);
    }

    // Set confirmed and shipped status
    await setConfirmedAndShippedStatus(order);
    
    // Store order ID for when driver returns
    navigationStartedRef.current = order.id;
    setPendingDeliveryOrder(order);

    // Build Google Maps URL for navigation
    const destLat = order.latitude;
    const destLng = order.longitude;
    const address = encodeURIComponent([
      order.address_1,
      order.city,
      order.province,
      order.postal
    ].filter(Boolean).join(', '));

    // Try Google Maps app first, fallback to web
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&destination_place_id=${address}&travelmode=driving`;

    // Open external Google Maps
    window.open(googleMapsUrl, '_blank');
  }, [setConfirmedAndShippedStatus, driverLocation]);

  // Handle delivery outcome selection
  const handleDeliveryOutcome = async (deliveryStatus: string) => {
    if (!pendingDeliveryOrder) return;

    setIsUpdating(true);
    try {
      const locationData = await fetchDriverLocationData();
      const newStatus = outcomeType === 'delivered' ? 'COMPLETED_DELIVERED' : 'COMPLETED_INCOMPLETE';

      const result = await updateOrderStatus(
        pendingDeliveryOrder.id,
        pendingDeliveryOrder.tracking_id || null,
        newStatus as TimelineStatus,
        deliveryStatus,
        {
          ip_address: locationData.ip_address,
          geolocation: locationData.geolocation,
          access_location: locationData.access_location
        }
      );

      if (result.success) {
        toast.success(outcomeType === 'delivered' ? 'Delivery completed!' : 'Delivery marked as incomplete');
        
        // Generate route snapshot in background (non-blocking)
        if (pendingDeliveryOrder.latitude && pendingDeliveryOrder.longitude) {
          (async () => {
            try {
              // Use stored driver start location from when navigation began
              const startLat = driverStartLocationRef.current?.lat || driverLocation?.lat;
              const startLng = driverStartLocationRef.current?.lng || driverLocation?.lng;
              
              if (startLat && startLng) {
                console.log('Generating route snapshot from navigation start to destination...');
                console.log('Start:', startLat, startLng);
                console.log('End:', pendingDeliveryOrder.latitude, pendingDeliveryOrder.longitude);
                
                const snapshotResult = await generateRouteSnapshot({
                  orderId: pendingDeliveryOrder.id,
                  driverLat: startLat,
                  driverLng: startLng,
                  destinationLat: pendingDeliveryOrder.latitude!,
                  destinationLng: pendingDeliveryOrder.longitude!,
                  trackingId: pendingDeliveryOrder.tracking_id || undefined,
                });
                
                if (snapshotResult.success) {
                  console.log('Route snapshot generated successfully:', snapshotResult.snapshotUrl);
                } else {
                  console.error('Route snapshot failed:', snapshotResult.error);
                }
              } else {
                console.warn('No driver start location available for snapshot');
              }
            } catch (err) {
              console.error('Route snapshot error:', err);
            } finally {
              // Clear stored start location
              driverStartLocationRef.current = null;
            }
          })();
        }
        
        // Remove completed order from lists
        const remainingOrders = filteredOrders.filter(o => o.id !== pendingDeliveryOrder.id);
        setFilteredOrders(remainingOrders);
        setOrders(prev => prev.filter(o => o.id !== pendingDeliveryOrder.id));
        updateMarkers(remainingOrders);
        
        // Close outcome sheet
        setShowOutcomeSheet(false);
        setOutcomeType(null);
        setPendingDeliveryOrder(null);
        navigationStartedRef.current = null;
        clearRoute();

        // Check for next delivery and show card
        if (remainingOrders.length > 0) {
          // Recalculate distances for remaining orders
          if (driverLocation) {
            const sortedOrders = await calculateDistances(driverLocation, remainingOrders);
            setFilteredOrders(sortedOrders);
            updateMarkers(sortedOrders);
            setNextDeliveryOrder(sortedOrders[0]);
            setShowNextDeliveryCard(true);
          } else {
            setNextDeliveryOrder(remainingOrders[0]);
            setShowNextDeliveryCard(true);
          }
        } else {
          toast.success('All deliveries in this zone completed!');
        }
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating delivery outcome:', err);
      toast.error('Failed to update delivery status');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle zone selection
  const handleZoneSelect = useCallback(async (zone: GeoZone) => {
    setSelectedZone(zone);
    setShowNextDeliveryCard(false);
    setNextDeliveryOrder(null);
    
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

  // Detect when driver returns to app from navigation
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigationStartedRef.current) {
        // Driver returned from Google Maps - show delivery outcome modal
        const orderId = navigationStartedRef.current;
        const order = orders.find(o => o.id === orderId) || filteredOrders.find(o => o.id === orderId);
        
        if (order && order.timeline_status === 'IN_ROUTE') {
          setPendingDeliveryOrder(order);
          // Small delay to let the app settle
          setTimeout(() => {
            setShowOutcomeSheet(true);
          }, 500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [orders, filteredOrders]);

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

        // Create map with Uber-style styling
        mapRef.current = new google.maps.Map(mapContainer.current, {
          center: initialLocation,
          zoom: 13,
          styles: UBER_MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
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
      markersRef.current.forEach(marker => marker.setMap(null));
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setMap(null);
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
      {selectedZone && filteredOrders.length > 0 && !selectedOrder && !showNextDeliveryCard && (
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
                      {order.name || 'Unknown Client'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {order.address_1}, {order.city}
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
      {selectedOrder && !showNextDeliveryCard && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-foreground">
                    {selectedOrder.name || 'Unknown Client'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {[selectedOrder.address_1, selectedOrder.address_2].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedOrder.city}, {selectedOrder.province} {selectedOrder.postal}
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
                  onClick={() => handleStartNavigation(selectedOrder)}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
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

      {/* Next Delivery Card - shown after completing a delivery */}
      {showNextDeliveryCard && nextDeliveryOrder && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <Card className="bg-background/95 backdrop-blur-sm shadow-lg border-2 border-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-700 dark:text-green-400">Next Delivery</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setShowNextDeliveryCard(false);
                    setNextDeliveryOrder(null);
                  }}
                >
                  Dismiss
                </Button>
              </div>
              <div className="mb-3">
                <p className="font-medium text-foreground">
                  {nextDeliveryOrder.name || 'Unknown Client'}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {[nextDeliveryOrder.address_1, nextDeliveryOrder.address_2].filter(Boolean).join(', ')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {nextDeliveryOrder.city}, {nextDeliveryOrder.province} {nextDeliveryOrder.postal}
                </p>
                {nextDeliveryOrder.drivingDuration && (
                  <p className="text-xs text-primary mt-1">
                    ~{Math.round(nextDeliveryOrder.drivingDuration / 60)} min away
                  </p>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    setShowNextDeliveryCard(false);
                    handleStartNavigation(nextDeliveryOrder);
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Start Navigation
                </Button>
                <Button 
                  variant="outline"
                  size="sm" 
                  onClick={() => {
                    setShowNextDeliveryCard(false);
                    setSelectedOrder(nextDeliveryOrder);
                    drawRoute(nextDeliveryOrder);
                  }}
                >
                  View on Map
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delivery Outcome Bottom Sheet */}
      <Sheet open={showOutcomeSheet} onOpenChange={setShowOutcomeSheet}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          <SheetHeader className="text-left">
            <SheetTitle>
              {!outcomeType ? 'Mark Delivery Outcome' : (
                outcomeType === 'delivered' ? 'Confirm Delivery' : 'Delivery Incomplete'
              )}
            </SheetTitle>
            <SheetDescription>
              {pendingDeliveryOrder && (
                <span className="block mt-1">
                  {pendingDeliveryOrder.city}, {pendingDeliveryOrder.province} {pendingDeliveryOrder.postal}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {!outcomeType ? (
              <>
                <Button
                  size="lg"
                  className="w-full h-16 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold"
                  onClick={() => setOutcomeType('delivered')}
                >
                  <CheckCircle className="w-6 h-6 mr-3" />
                  Delivered
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="w-full h-16 text-lg font-semibold"
                  onClick={() => setOutcomeType('incomplete')}
                >
                  <XCircle className="w-6 h-6 mr-3" />
                  Delivery Incomplete
                </Button>
              </>
            ) : (
              <>
                {DELIVERY_OUTCOMES[outcomeType].map((outcome) => (
                  <Button
                    key={outcome.value}
                    variant="outline"
                    className="w-full justify-start h-14 text-left"
                    onClick={() => handleDeliveryOutcome(outcome.value)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    ) : outcomeType === 'delivered' ? (
                      <CheckCircle className="w-5 h-5 mr-3 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 mr-3 text-destructive" />
                    )}
                    {outcome.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => setOutcomeType(null)}
                  disabled={isUpdating}
                >
                  Back
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
