import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, MapPin, ChevronRight, ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { setGoogleMapsOptions } from '@/lib/googleMapsConfig';

type GeoZone = 'north' | 'east' | 'west' | 'south';

interface OrderWithDistance extends Order {
  distance?: number;
}

export default function DriverZoneDeliveryList() {
  const { zone } = useParams<{ zone: GeoZone }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const haptic = useHapticFeedback();
  
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const getDriverLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const fetchOrders = useCallback(async () => {
    if (!user || !zone) return;

    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('assigned_driver_id', user.id)
        .eq('geo_zone', zone.toUpperCase())
        .not('timeline_status', 'in', '("COMPLETED_DELIVERED","COMPLETED_INCOMPLETE")');

      if (data) {
        let ordersWithDistance = data as OrderWithDistance[];
        
        if (driverLocation) {
          ordersWithDistance = ordersWithDistance.map(order => ({
            ...order,
            distance: order.latitude && order.longitude 
              ? calculateDistance(driverLocation.lat, driverLocation.lng, order.latitude, order.longitude)
              : Infinity
          }));
          ordersWithDistance.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        }
        
        setOrders(ordersWithDistance);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, zone, driverLocation]);

  useEffect(() => {
    getDriverLocation();
  }, [getDriverLocation]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Initialize Google Maps when expanded
  useEffect(() => {
    if (!isMapExpanded || mapLoaded || !mapRef.current) return;

    const initMap = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-google-maps-key');
        if (!data?.apiKey) return;

        setGoogleMapsOptions({ key: data.apiKey });
        
        const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;

        const center = driverLocation || { lat: 43.6532, lng: -79.3832 };
        
        const map = new Map(mapRef.current!, {
          center,
          zoom: 12,
          mapId: 'driver-zone-map',
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] }
          ]
        });

        googleMapRef.current = map;

        // Add driver marker
        if (driverLocation) {
          const driverEl = document.createElement('div');
          driverEl.innerHTML = `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>`;
          new AdvancedMarkerElement({
            map,
            position: driverLocation,
            content: driverEl
          });
        }

        // Add delivery markers
        const bounds = new google.maps.LatLngBounds();
        if (driverLocation) bounds.extend(driverLocation);

        orders.forEach((order, index) => {
          if (!order.latitude || !order.longitude) return;
          
          const position = { lat: order.latitude, lng: order.longitude };
          bounds.extend(position);

          const markerEl = document.createElement('div');
          markerEl.innerHTML = `
            <div class="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full font-bold text-sm shadow-lg border-2 border-white">
              ${index + 1}
            </div>
          `;
          
          const marker = new AdvancedMarkerElement({
            map,
            position,
            content: markerEl
          });

          marker.addListener('click', () => {
            haptic.light();
            navigate(`/driver-delivery/${order.id}`, { state: { orderNumber: index + 1 } });
          });

          markersRef.current.push(marker);
        });

        if (orders.length > 0 || driverLocation) {
          map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        }

        setMapLoaded(true);
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();
  }, [isMapExpanded, mapLoaded, driverLocation, orders, navigate, haptic]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`driver-zone-list-${user.id}-${zone}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `assigned_driver_id=eq.${user.id}`
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, zone, fetchOrders]);

  const handleRefresh = async () => {
    getDriverLocation();
    await fetchOrders();
  };

  const handleOrderClick = (order: Order, orderNumber: number) => {
    haptic.light();
    navigate(`/driver-delivery/${order.id}`, { state: { orderNumber } });
  };

  const toggleMap = () => {
    haptic.light();
    setIsMapExpanded(!isMapExpanded);
  };

  const getPublicTimelineStatus = (status: string | null) => {
    switch (status) {
      case 'PENDING':
        return { label: 'PENDING', variant: 'secondary' as const };
      case 'PICKED_UP_AND_ASSIGNED':
        return { label: 'PICKED UP', variant: 'default' as const };
      case 'CONFIRMED':
      case 'IN_ROUTE':
        return { label: 'SHIPPED', variant: 'default' as const };
      case 'COMPLETED_DELIVERED':
        return { label: 'DELIVERED', variant: 'default' as const };
      case 'COMPLETED_INCOMPLETE':
        return { label: 'INCOMPLETE', variant: 'destructive' as const };
      default:
        return { label: 'PENDING', variant: 'secondary' as const };
    }
  };

  const zoneTitle = zone ? zone.charAt(0).toUpperCase() + zone.slice(1) : '';

  return (
    <AppLayout title={`${zoneTitle} Zone`} showBackButton>
      <PullToRefresh onRefresh={handleRefresh} className="h-[calc(100vh-8rem)]">
        <div className="flex flex-col h-full">
          {/* Collapsible Map Preview */}
          <div className="border-b border-border bg-card">
            <button
              onClick={toggleMap}
              className="w-full p-3 flex items-center justify-between active:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Zone Map</span>
                <Badge variant="outline" className="text-xs">
                  {orders.length} stops
                </Badge>
              </div>
              {isMapExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            
            <div 
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isMapExpanded ? 'h-48' : 'h-0'
              }`}
            >
              <div ref={mapRef} className="w-full h-48" />
            </div>
          </div>

          {/* Delivery List */}
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {/* Status Bar */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                {orders.length} {orders.length === 1 ? 'delivery' : 'deliveries'}
              </p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-muted-foreground">Closest first</span>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                        <div className="h-3 bg-muted rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground font-medium">No deliveries in this zone</p>
                  <p className="text-xs text-muted-foreground mt-1">Check back later or select another zone</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {orders.map((order, index) => {
                  const status = getPublicTimelineStatus(order.timeline_status);
                  const isCompleted = order.timeline_status === 'COMPLETED_DELIVERED' || 
                                     order.timeline_status === 'COMPLETED_INCOMPLETE';
                  
                  return (
                    <Card 
                      key={order.id}
                      className={`overflow-hidden transition-all ${
                        isCompleted 
                          ? 'opacity-50 bg-muted' 
                          : 'bg-card active:scale-[0.98]'
                      }`}
                      onClick={() => !isCompleted && handleOrderClick(order, index + 1)}
                    >
                      <CardContent className="p-0">
                        <div className="flex items-stretch">
                          {/* Order Number Pill */}
                          <div className={`flex-shrink-0 w-14 flex items-center justify-center ${
                            isCompleted ? 'bg-muted' : 'bg-primary'
                          }`}>
                            <span className={`text-xl font-bold ${
                              isCompleted ? 'text-muted-foreground' : 'text-primary-foreground'
                            }`}>
                              {index + 1}
                            </span>
                          </div>

                          {/* Order Content */}
                          <div className="flex-1 p-3 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-foreground truncate">
                                {order.name || 'Unknown Client'}
                              </span>
                              <Badge variant={status.variant} className="text-xs flex-shrink-0">
                                {status.label}
                              </Badge>
                            </div>
                            
                            {/* Address */}
                            <div className="flex items-start gap-1.5 text-muted-foreground mb-2">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                              <span className="text-sm line-clamp-2">
                                {order.address_1}{order.address_2 ? `, ${order.address_2}` : ''}, {order.city}
                              </span>
                            </div>

                            {/* IDs Row */}
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-muted-foreground">
                                Ship: <span className="font-medium text-foreground">{order.shipment_id || '—'}</span>
                              </span>
                              <span className="text-muted-foreground">
                                Track: <span className="font-medium text-foreground">{order.tracking_id || '—'}</span>
                              </span>
                            </div>
                          </div>

                          {/* Arrow */}
                          {!isCompleted && (
                            <div className="flex items-center pr-3">
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
