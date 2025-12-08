import { useEffect, useState, useCallback } from 'react';
import { Package, Navigation, MapPin, CheckCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { DriverStatusUpdateModal } from '@/components/orders/DriverStatusUpdateModal';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from '@/hooks/use-toast';
import { OrderCard } from '@/components/orders/OrderCard';

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const haptic = useHapticFeedback();

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('assigned_driver_id', user.id)
        .order('created_at', { ascending: false });

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

  // Realtime subscription for driver's orders
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`driver-orders-${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `assigned_driver_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => [payload.new as Order, ...prev]);
            haptic.success();
            toast({
              title: 'New Order Assigned',
              description: `Order for ${(payload.new as Order).name || 'a client'} has been assigned to you.`,
            });
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev => 
              prev.map(order => 
                order.id === payload.new.id ? (payload.new as Order) : order
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(order => order.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, haptic]);

  const handleRefresh = async () => {
    await fetchOrders();
  };


  const getActionButton = (order: Order) => {
    switch (order.timeline_status) {
      case 'PICKED_UP':
        return (
          <Button
            size="sm"
            className="w-full mt-3"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOrder(order);
            }}
          >
            <Navigation className="w-4 h-4 mr-1" />
            Confirm & Start Route
          </Button>
        );
      case 'SHIPPED':
        return (
          <Button
            size="sm"
            className="w-full mt-3"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOrder(order);
            }}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Complete Delivery
          </Button>
        );
      default:
        return null;
    }
  };

  const activeOrders = orders.filter(o => o.timeline_status !== 'DELIVERED' && o.timeline_status !== 'DELIVERY_INCOMPLETE');
  const completedOrders = orders.filter(o => o.timeline_status === 'DELIVERED' || o.timeline_status === 'DELIVERY_INCOMPLETE');

  return (
    <AppLayout title="My Orders" showBackButton>
      <PullToRefresh onRefresh={handleRefresh} className="h-[calc(100vh-8rem)]">
        <div className="p-4 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Active Deliveries</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-muted-foreground">
                  {activeOrders.length} active
                </span>
              </div>
            </div>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-lg p-4 border border-border animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : activeOrders.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No active deliveries</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Orders will appear here when assigned
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <div key={order.id} className="space-y-0">
                  <OrderCard 
                    order={order} 
                    onClick={() => setSelectedOrder(order)} 
                  />
                  {getActionButton(order)}
                </div>
              ))}
            </div>
          )}
        </div>

        {completedOrders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              Completed Today
            </h3>
            <div className="space-y-3 opacity-75">
              {completedOrders.slice(0, 5).map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onClick={() => {}} 
                />
              ))}
            </div>
          </div>
        )}
        </div>
      </PullToRefresh>

      <DriverStatusUpdateModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onSuccess={() => {
          setSelectedOrder(null);
          fetchOrders();
        }}
      />
    </AppLayout>
  );
}
