import { useEffect, useState, useCallback } from 'react';
import { Package, MapPin, Phone, Clock, Navigation, CheckCircle } from 'lucide-react';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'IN_ROUTE': return 'bg-purple-100 text-purple-800';
      case 'ARRIVED': return 'bg-indigo-100 text-indigo-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'REQUEST_ADDRESS_REVIEW': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDOB = (dob: string | null) => {
    if (!dob) return 'N/A';
    return new Date(dob).getFullYear().toString();
  };

  const getActionButton = (order: Order) => {
    switch (order.timeline_status) {
      case 'CONFIRMED':
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
            Start Route
          </Button>
        );
      case 'IN_ROUTE':
        return (
          <Button
            size="sm"
            className="w-full mt-3"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedOrder(order);
            }}
          >
            <MapPin className="w-4 h-4 mr-1" />
            Mark Arrived
          </Button>
        );
      case 'ARRIVED':
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
            Complete
          </Button>
        );
      default:
        return null;
    }
  };

  const activeOrders = orders.filter(o => o.timeline_status !== 'COMPLETED');
  const completedOrders = orders.filter(o => o.timeline_status === 'COMPLETED');

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
                <Card
                  key={order.id}
                  className="bg-card border-border"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {order.name || 'Unknown Client'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          DOB Year: {formatDOB(order.dob)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.timeline_status)}`}>
                        {order.timeline_status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start text-muted-foreground">
                        <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span>
                          {order.address_1}
                          {order.address_2 && `, ${order.address_2}`}
                          <br />
                          {order.city}, {order.province} {order.postal}
                        </span>
                      </div>
                      {order.phone_number && (
                        <a
                          href={`tel:${order.phone_number}`}
                          className="flex items-center text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          <span>{order.phone_number}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {order.shipment_id || 'No shipment ID'}
                      </div>
                    </div>

                    {getActionButton(order)}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {completedOrders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              Completed Today
            </h3>
            <div className="space-y-3">
              {completedOrders.slice(0, 5).map((order) => (
                <Card key={order.id} className="bg-card border-border opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {order.name || 'Unknown Client'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {order.city}, {order.province}
                        </p>
                        {order.delivery_status && (
                          <p className="text-xs text-green-600 mt-1">
                            {order.delivery_status.replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Completed
                      </span>
                    </div>
                  </CardContent>
                </Card>
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
