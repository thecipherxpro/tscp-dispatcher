import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Package, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { cn } from '@/lib/utils';

type GeoZone = 'NORTH' | 'EAST' | 'WEST' | 'SOUTH';

const ZONES: GeoZone[] = ['NORTH', 'EAST', 'WEST', 'SOUTH'];

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
    <AppLayout title="Zones">
      <PullToRefresh onRefresh={handleRefresh} className="h-[calc(100vh-8rem)]">
        <div className="p-4 space-y-6">
          {/* Minimal Header Stats */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-muted-foreground">Active Deliveries</p>
              <p className="text-3xl font-bold text-foreground tracking-tight">{totalActive}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Package className="w-6 h-6 text-muted-foreground" />
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
