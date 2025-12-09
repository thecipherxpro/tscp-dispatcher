import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle, MapPin, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';

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
          // Find current active order (IN_ROUTE first, then CONFIRMED, then PICKED_UP_AND_ASSIGNED)
          const activeOrder = allOrders.find(o => o.timeline_status === 'IN_ROUTE') ||
            allOrders.find(o => o.timeline_status === 'CONFIRMED') ||
            allOrders.find(o => o.timeline_status === 'PICKED_UP_AND_ASSIGNED');
          
          setCurrentOrder(activeOrder as Order || null);
          
          // Recent completed orders
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
      case 'PICKED_UP_AND_ASSIGNED':
        return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Assigned</Badge>;
      case 'CONFIRMED':
        return <Badge className="bg-blue-500 hover:bg-blue-500 text-white">Confirmed</Badge>;
      case 'IN_ROUTE':
        return <Badge className="bg-primary hover:bg-primary text-primary-foreground">In Transit</Badge>;
      case 'COMPLETED_DELIVERED':
        return <Badge variant="outline" className="border-green-500 text-green-600">Done</Badge>;
      case 'COMPLETED_INCOMPLETE':
        return <Badge variant="outline" className="border-destructive text-destructive">Incomplete</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTimelineProgress = (status: string) => {
    switch (status) {
      case 'PICKED_UP_AND_ASSIGNED': return 1;
      case 'CONFIRMED': return 2;
      case 'IN_ROUTE': return 3;
      case 'COMPLETED_DELIVERED':
      case 'COMPLETED_INCOMPLETE': return 4;
      default: return 0;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-CA', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

        {/* Current Shipping Card */}
        {currentOrder && (
          <Card 
            className="bg-card border-border cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/my-orders')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Current delivery</h3>
                {getStatusBadge(currentOrder.timeline_status)}
              </div>
              
              <p className="text-sm text-muted-foreground mb-1">
                {currentOrder.shipment_id || 'Pending ID'}
              </p>
              
              <div className="flex items-start gap-2 mb-4">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  {currentOrder.name || 'Unknown'}
                  {currentOrder.city && `, ${currentOrder.city}`}
                </p>
              </div>

              {/* Timeline Progress */}
              <div className="flex items-center justify-between mb-4">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center">
                    <div 
                      className={`w-3 h-3 rounded-full ${
                        step <= getTimelineProgress(currentOrder.timeline_status)
                          ? 'bg-primary'
                          : 'bg-muted'
                      }`}
                    />
                    {step < 4 && (
                      <div 
                        className={`w-16 h-0.5 ${
                          step < getTimelineProgress(currentOrder.timeline_status)
                            ? 'bg-primary'
                            : 'bg-muted'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Dates */}
              <div className="flex justify-between text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Assigned</p>
                  <p className="font-medium text-foreground">{formatDate(currentOrder.assigned_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Ship Date</p>
                  <p className="font-medium text-foreground">{formatDate(currentOrder.ship_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!currentOrder && !isLoading && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <Truck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No active deliveries</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Check My Orders for pending assignments</p>
            </CardContent>
          </Card>
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
