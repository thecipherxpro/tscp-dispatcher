import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, MapPin, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

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
  const haptic = useHapticFeedback();

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
        
        // Sort by distance if driver location available
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
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {orders.length} {orders.length === 1 ? 'delivery' : 'deliveries'}
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-muted-foreground">Sorted by distance</span>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-lg p-4 border border-border animate-pulse">
                  <div className="h-8 bg-muted rounded w-12 mb-3" />
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No deliveries in this zone</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {orders.map((order, index) => {
                const status = getPublicTimelineStatus(order.timeline_status);
                const isCompleted = order.timeline_status === 'COMPLETED_DELIVERED' || 
                                   order.timeline_status === 'COMPLETED_INCOMPLETE';
                
                return (
                  <Card 
                    key={order.id}
                    className={`transition-all border ${
                      isCompleted 
                        ? 'opacity-50 bg-muted cursor-not-allowed' 
                        : 'bg-card border-border cursor-pointer active:scale-[0.98]'
                    }`}
                    onClick={() => !isCompleted && handleOrderClick(order, index + 1)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Order Number */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                          isCompleted 
                            ? 'bg-muted text-muted-foreground' 
                            : 'bg-primary text-primary-foreground'
                        }`}>
                          {index + 1}
                        </div>

                        {/* Order Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-foreground">
                              {order.shipment_id || 'No Shipment ID'}
                            </span>
                            <Badge variant={status.variant} className="text-xs">
                              {status.label}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span className="text-sm truncate">
                              {order.city}, {order.province} {order.postal}
                            </span>
                          </div>
                        </div>

                        {/* Arrow */}
                        {!isCompleted && (
                          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
