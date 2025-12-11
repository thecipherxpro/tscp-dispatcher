import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Package, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { cn } from '@/lib/utils';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type GeoZone = 'NORTH' | 'EAST' | 'WEST' | 'SOUTH';

const ZONES: GeoZone[] = ['NORTH', 'EAST', 'WEST', 'SOUTH'];

export default function DriverZoneDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const haptic = useHapticFeedback();

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('assigned_driver_id', user.id)
        .not('timeline_status', 'in', '("COMPLETED_DELIVERED","COMPLETED_INCOMPLETE")');

      if (data) {
        setOrders(data as Order[]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Get driver location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // Default to Toronto if location unavailable
          setDriverLocation({ lat: 43.6532, lng: -79.3832 });
        }
      );
    }
  }, []);

  // Initialize map when expanded
  useEffect(() => {
    if (!isMapExpanded || !mapContainerRef.current || mapRef.current) return;

    const initMap = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        if (!data?.token) return;

        mapboxgl.accessToken = data.token;

        const center = driverLocation || { lat: 43.6532, lng: -79.3832 };
        
        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [center.lng, center.lat],
          zoom: 11
        });

        // Add driver marker
        if (driverLocation) {
          markerRef.current = new mapboxgl.Marker({ color: '#3B82F6' })
            .setLngLat([driverLocation.lng, driverLocation.lat])
            .addTo(mapRef.current);
        }

        // Add order markers
        orders.forEach(order => {
          if (order.latitude && order.longitude) {
            new mapboxgl.Marker({ color: '#F97316' })
              .setLngLat([order.longitude, order.latitude])
              .addTo(mapRef.current!);
          }
        });

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isMapExpanded, driverLocation, orders]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`driver-zone-orders-${user.id}`)
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
  }, [user, fetchOrders]);

  const getZoneCount = (zone: GeoZone) => {
    return orders.filter(o => o.geo_zone === zone).length;
  };

  const handleZoneClick = (zone: GeoZone) => {
    haptic.light();
    navigate(`/driver-zone/${zone.toLowerCase()}`);
  };

  const handleRefresh = async () => {
    await fetchOrders();
  };

  const totalActive = orders.length;

  return (
    <AppLayout title="Zones">
      <PullToRefresh onRefresh={handleRefresh} className="h-[calc(100vh-8rem)]">
        <div className="p-4 space-y-4">
          {/* Collapsible Map View */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <button
              onClick={() => {
                haptic.light();
                setIsMapExpanded(!isMapExpanded);
              }}
              className="w-full flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Delivery Map</p>
                  <p className="text-xs text-muted-foreground">{totalActive} active deliveries</p>
                </div>
              </div>
              {isMapExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            
            <div className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden",
              isMapExpanded ? "h-48" : "h-0"
            )}>
              <div ref={mapContainerRef} className="w-full h-full" />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Zone List */}
          <div className="space-y-2">
            {isLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-full" />
                        <div className="h-5 bg-muted rounded w-16" />
                      </div>
                      <div className="h-6 bg-muted rounded w-8" />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {ZONES.map((zone) => {
                  const count = getZoneCount(zone);
                  const hasDeliveries = count > 0;
                  
                  return (
                    <button 
                      key={zone}
                      className={cn(
                        "w-full bg-card rounded-xl p-4 border border-border",
                        "flex items-center justify-between",
                        "transition-all active:scale-[0.98]",
                        hasDeliveries && "border-primary/20"
                      )}
                      onClick={() => handleZoneClick(zone)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          hasDeliveries ? "bg-primary/10" : "bg-muted"
                        )}>
                          <MapPin className={cn(
                            "w-5 h-5",
                            hasDeliveries ? "text-primary" : "text-muted-foreground"
                          )} />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-foreground">{zone}</p>
                          <p className="text-xs text-muted-foreground">
                            {count} {count === 1 ? 'delivery' : 'deliveries'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {hasDeliveries && (
                          <span className="text-lg font-bold text-foreground">{count}</span>
                        )}
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Empty State */}
          {!isLoading && totalActive === 0 && (
            <div className="bg-muted/50 rounded-xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                <Package className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">No active deliveries</p>
              <p className="text-sm text-muted-foreground mt-1">
                Orders will appear here when assigned
              </p>
            </div>
          )}
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
