import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { Loader2, MapPin, AlertCircle, Navigation, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DriverMapViewProps {
  onOrderSelect?: (order: Order) => void;
}

interface RouteInfo {
  duration: number; // in seconds
  distance: number; // in meters
}

export function DriverMapView({ onOrderSelect }: DriverMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const routeLayerAdded = useRef(false);
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // Fetch Mapbox token
  const fetchMapboxToken = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) throw error;
      return data.token;
    } catch (err) {
      console.error('Error fetching Mapbox token:', err);
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
      return data as Order[];
    } catch (err) {
      console.error('Error fetching orders:', err);
      return [];
    }
  }, [user]);

  // Geocode an address to coordinates
  const geocodeAddress = async (order: Order, token: string): Promise<[number, number] | null> => {
    const address = [
      order.address_1,
      order.city,
      order.province,
      order.postal,
      order.country || 'Canada'
    ].filter(Boolean).join(', ');

    if (!address) return null;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        return data.features[0].center as [number, number];
      }
      return null;
    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  };

  // Get user's current location
  const getUserLocation = useCallback((): Promise<[number, number] | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve([position.coords.longitude, position.coords.latitude]);
        },
        () => {
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  // Get status color for markers
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'PICKED_UP_AND_ASSIGNED': return '#3b82f6'; // blue
      case 'CONFIRMED': return '#6366f1'; // indigo
      case 'IN_ROUTE': return '#f59e0b'; // amber
      case 'COMPLETED_DELIVERED': return '#22c55e'; // green
      case 'COMPLETED_INCOMPLETE': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  // Fetch and display route
  const fetchRoute = useCallback(async (origin: [number, number], destination: [number, number]) => {
    if (!mapboxToken || !map.current) return;

    setIsLoadingRoute(true);
    setRouteInfo(null);

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?geometries=geojson&overview=full&access_token=${mapboxToken}`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const routeGeometry = route.geometry;

        // Set route info
        setRouteInfo({
          duration: route.duration,
          distance: route.distance
        });

        // Add or update route layer
        if (map.current?.getSource('route')) {
          (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: routeGeometry
          });
        } else {
          map.current?.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: routeGeometry
            }
          });

          map.current?.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#f97316',
              'line-width': 5,
              'line-opacity': 0.85
            }
          });
          routeLayerAdded.current = true;
        }

        // Fit map to show route
        const coordinates = routeGeometry.coordinates;
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
        map.current?.fitBounds(bounds, { padding: 80 });
      }
    } catch (err) {
      console.error('Error fetching route:', err);
    } finally {
      setIsLoadingRoute(false);
    }
  }, [mapboxToken]);

  // Handle order selection from dropdown
  const handleOrderSelection = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !mapboxToken) return;

    setSelectedOrder(order);

    // Get destination coordinates
    const destination = await geocodeAddress(order, mapboxToken);
    if (!destination) return;

    // Get current user location
    const currentLocation = await getUserLocation();
    if (currentLocation) {
      setUserLocation(currentLocation);
      fetchRoute(currentLocation, destination);
    }
  };

  // Clear route
  const clearRoute = () => {
    if (map.current?.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current?.getSource('route')) {
      map.current.removeSource('route');
    }
    routeLayerAdded.current = false;
    setRouteInfo(null);
    setSelectedOrder(null);
  };

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      if (!mapContainer.current) return;

      try {
        setIsLoading(true);
        setError(null);

        const token = await fetchMapboxToken();
        setMapboxToken(token);
        mapboxgl.accessToken = token;

        const fetchedOrders = await fetchOrders();
        setOrders(fetchedOrders);

        const location = await getUserLocation();
        setUserLocation(location);

        // Default to Toronto if no location
        const center = location || [-79.3832, 43.6532];

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/towdaddy/cmixhpbr7000b01qi6so2exwj',
          center: center,
          zoom: 12,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.current.addControl(
          new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true
          }),
          'top-right'
        );

        // Wait for map to load
        map.current.on('load', async () => {
          // Add order markers
          for (const order of fetchedOrders) {
            const coords = await geocodeAddress(order, token);
            if (coords) {
              const el = document.createElement('div');
              el.className = 'order-marker';
              el.style.cssText = `
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
              `;
              el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;

              const marker = new mapboxgl.Marker(el)
                .setLngLat(coords)
                .addTo(map.current!);

              el.addEventListener('click', () => {
                handleOrderSelection(order.id);
              });

              markersRef.current.push(marker);
            }
          }

          setIsLoading(false);
        });

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load map');
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.current?.remove();
    };
  }, [fetchMapboxToken, fetchOrders, getUserLocation]);

  const handleNavigate = (order: Order) => {
    const address = [
      order.address_1,
      order.city,
      order.province,
      order.postal
    ].filter(Boolean).join(', ');
    
    // Open in Google Maps for navigation
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  };

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

      {/* Top controls */}
      <div className="absolute top-4 left-4 right-16 z-10 space-y-2">
        {/* Delivery Selection Dropdown */}
        <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-2">
          <Select 
            value={selectedOrder?.id || ''} 
            onValueChange={handleOrderSelection}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a delivery to navigate" />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border shadow-lg z-50">
              {orders.map((order) => (
                <SelectItem key={order.id} value={order.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: getStatusColor(order.timeline_status) }} 
                    />
                    <span className="truncate">
                      {order.name || 'Unknown'} - {order.address_1?.slice(0, 20)}...
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Order count badge */}
        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm shadow-md">
          <MapPin className="w-3 h-3 mr-1" />
          {orders.length} {orders.length === 1 ? 'delivery' : 'deliveries'}
        </Badge>
      </div>

      {/* Route info card */}
      {(routeInfo || isLoadingRoute) && (
        <div className="absolute top-28 left-4 z-10">
          <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-3">
              {isLoadingRoute ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Calculating route...</span>
                </div>
              ) : routeInfo && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {formatDuration(routeInfo.duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {formatDistance(routeInfo.distance)}
                    </span>
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

      {/* Selected order card */}
      {selectedOrder && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-foreground">{selectedOrder.name || 'Unknown Client'}</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.address_1}, {selectedOrder.city}
                  </p>
                </div>
                <Badge 
                  variant="secondary"
                  className={
                    selectedOrder.timeline_status === 'IN_ROUTE' ? 'bg-amber-100 text-amber-800' :
                    selectedOrder.timeline_status === 'COMPLETED_DELIVERED' ? 'bg-green-100 text-green-800' :
                    selectedOrder.timeline_status === 'COMPLETED_INCOMPLETE' ? 'bg-red-100 text-red-800' :
                    selectedOrder.timeline_status === 'CONFIRMED' ? 'bg-indigo-100 text-indigo-800' :
                    'bg-blue-100 text-blue-800'
                  }
                >
                  {selectedOrder.timeline_status?.replace(/_/g, ' ') || 'Pending'}
                </Badge>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleNavigate(selectedOrder)}
                >
                  <Navigation className="w-4 h-4 mr-1" />
                  Navigate
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    onOrderSelect?.(selectedOrder);
                  }}
                >
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}