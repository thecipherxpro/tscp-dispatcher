import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle, ChevronRight, LogOut } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { ActiveDeliveryCard } from '@/components/orders/ActiveDeliveryCard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

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
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">Done</Badge>;
      case 'COMPLETED_INCOMPLETE':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Incomplete</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const statItems = [
    { label: 'Pending', value: stats.assignedOrders, icon: Package },
    { label: 'In Route', value: stats.inRouteOrders, icon: Truck },
    { label: 'Today', value: stats.completedToday, icon: CheckCircle },
  ];

  return (
    <AppLayout title="Dashboard" showUserMenu>
      <div className="p-4 space-y-6">
        {/* Welcome Card - Matching Admin Style */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 border-0 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-primary-foreground/70 text-sm">Welcome back,</p>
                <h2 className="text-xl font-bold text-primary-foreground">
                  {profile?.full_name || 'Driver'}
                </h2>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0">
                    Driver
                  </Badge>
                  {profile?.driver_id && (
                    <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0">
                      {profile.driver_id}
                    </Badge>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5 text-primary-foreground" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          {statItems.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="bg-card border border-border rounded-xl p-4 text-center"
            >
              <div className="w-10 h-10 rounded-full bg-muted mx-auto mb-2 flex items-center justify-center">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {isLoading ? '-' : value}
              </p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Active Delivery Card */}
        {currentOrder && (
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Current Delivery</h3>
            <ActiveDeliveryCard 
              order={currentOrder} 
              onClick={() => navigate(`/driver-delivery/${currentOrder.id}`)}
            />
          </div>
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
                <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="bg-muted/50 rounded-xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                <Package className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">No completed deliveries yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your recent deliveries will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <button 
                  key={order.id} 
                  className={cn(
                    "w-full bg-card rounded-xl p-4 border border-border",
                    "flex items-center gap-3 text-left",
                    "transition-all active:scale-[0.98]"
                  )}
                  onClick={() => navigate('/my-orders')}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">
                      {order.shipment_id || 'No ID'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {order.geo_zone || order.address_line_1 || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(order.timeline_status)}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
