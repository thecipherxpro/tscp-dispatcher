import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Package } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

type GeoZone = 'NORTH' | 'EAST' | 'WEST' | 'SOUTH';

const ZONES: { zone: GeoZone; color: string; bgColor: string }[] = [
  { zone: 'NORTH', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
  { zone: 'EAST', color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
  { zone: 'WEST', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
  { zone: 'SOUTH', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' },
];

export default function DriverZoneDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    <AppLayout title="Delivery Zones">
      <PullToRefresh onRefresh={handleRefresh} className="h-[calc(100vh-8rem)]">
        <div className="p-4 space-y-6">
          {/* Header Stats */}
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Active Deliveries</p>
                <p className="text-4xl font-bold">{totalActive}</p>
              </div>
              <Package className="w-12 h-12 opacity-80" />
            </div>
          </div>

          {/* Zone Selection */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Select Zone</h3>
            
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card rounded-xl p-6 border border-border animate-pulse">
                    <div className="h-6 bg-muted rounded w-1/2 mb-2" />
                    <div className="h-8 bg-muted rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {ZONES.map(({ zone, color, bgColor }) => {
                  const count = getZoneCount(zone);
                  return (
                    <Card 
                      key={zone}
                      className={`cursor-pointer transition-all active:scale-95 border-2 ${bgColor}`}
                      onClick={() => handleZoneClick(zone)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className={`w-5 h-5 ${color}`} />
                          <span className={`font-semibold ${color}`}>{zone}</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">{count}</p>
                        <p className="text-sm text-muted-foreground">
                          {count === 1 ? 'delivery' : 'deliveries'}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Empty State */}
          {!isLoading && totalActive === 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No active deliveries</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Orders will appear here when assigned
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
