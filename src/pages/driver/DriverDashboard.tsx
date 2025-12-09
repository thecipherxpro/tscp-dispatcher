import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { ActiveDeliveryCard } from '@/components/orders/ActiveDeliveryCard';

interface DriverStats {
  assignedOrders: number;
  inRouteOrders: number;
  completedToday: number;
}

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DriverStats>({
    assignedOrders: 0,
    inRouteOrders: 0,
    completedToday: 0,
  });
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const { data: allOrders } = await supabase
          .from('orders')
          .select('*')
          .eq('assigned_driver_id', user.id)
          .order('created_at', { ascending: false });

        if (allOrders) {
          const activeOrder = allOrders.find(o => o.timeline_status === 'IN_ROUTE') ||
            allOrders.find(o => o.timeline_status === 'CONFIRMED') ||
            allOrders.find(o => o.timeline_status === 'PICKED_UP_AND_ASSIGNED');
          
          setCurrentOrder(activeOrder as Order || null);
          
          const completedOrders = allOrders.filter(o => 
            o.timeline_status === 'COMPLETED_DELIVERED' || 
            o.timeline_status === 'COMPLETED_INCOMPLETE'
          );
          setRecentOrders(completedOrders.slice(0, 5) as Order[]);
          
          const today = new Date().toISOString().split('T')[0];
          setStats({
            assignedOrders: allOrders.filter(o => 
              o.timeline_status !== 'COMPLETED_DELIVERED' && 
              o.timeline_status !== 'COMPLETED_INCOMPLETE'
            ).length,
            inRouteOrders: allOrders.filter(o => o.timeline_status === 'IN_ROUTE').length,
            completedToday: allOrders.filter(o => 
              (o.timeline_status === 'COMPLETED_DELIVERED' || o.timeline_status === 'COMPLETED_INCOMPLETE') && 
              o.completed_at?.startsWith(today)
            ).length,
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED_DELIVERED':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Done</Badge>;
      case 'COMPLETED_INCOMPLETE':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Incomplete</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout title="Dashboard">
      <div className="p-4 space-y-6">
        {/* Welcome Card with Stats */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 border-0 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-primary-foreground/70 text-sm">Welcome back,</p>
            <h2 className="text-xl font-bold text-primary-foreground mb-4">
              {profile?.full_name || 'Driver'}
            </h2>
            
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-primary-foreground/10 rounded-lg p-3 text-center backdrop-blur-sm">
                <Package className="w-5 h-5 mx-auto mb-1 text-primary-foreground" />
                <p className="text-xl font-bold text-primary-foreground">
                  {isLoading ? '-' : stats.assignedOrders}
                </p>
                <p className="text-xs text-primary-foreground/70">Pending</p>
              </div>
              <div className="bg-primary-foreground/10 rounded-lg p-3 text-center backdrop-blur-sm">
                <Truck className="w-5 h-5 mx-auto mb-1 text-primary-foreground" />
                <p className="text-xl font-bold text-primary-foreground">
                  {isLoading ? '-' : stats.inRouteOrders}
                </p>
                <p className="text-xs text-primary-foreground/70">In Route</p>
              </div>
              <div className="bg-primary-foreground/10 rounded-lg p-3 text-center backdrop-blur-sm">
                <CheckCircle className="w-5 h-5 mx-auto mb-1 text-primary-foreground" />
                <p className="text-xl font-bold text-primary-foreground">
                  {isLoading ? '-' : stats.completedToday}
                </p>
                <p className="text-xs text-primary-foreground/70">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Delivery Card */}
        {currentOrder && (
          <ActiveDeliveryCard 
            order={currentOrder} 
            onClick={() => navigate('/my-orders')}
          />
        )}

        {/* Recent Deliveries */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Recent deliveries</h3>
            <button 
              onClick={() => navigate('/my-orders')}
              className="text-sm text-primary font-medium"
            >
              See all
            </button>
          </div>
          
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-lg p-4 border border-border animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-8 text-center">
                <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No completed deliveries yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <Card 
                  key={order.id} 
                  className="bg-card border-border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate('/my-orders')}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Truck className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">
                        {order.shipment_id || 'No ID'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.city || 'Unknown'}{order.province && ` - ${order.province}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(order.timeline_status)}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
