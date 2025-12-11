import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, CheckCircle, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { ActiveDeliveryCard } from '@/components/orders/ActiveDeliveryCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

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

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
        {/* Welcome Section with Avatar */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-primary/30 shadow-sm">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-lg font-semibold">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Welcome back,</p>
              <h2 className="text-xl font-bold text-foreground">
                {profile?.full_name || 'Driver'}
              </h2>
              {profile?.driver_id && (
                <p className="text-xs text-primary/70 font-medium">{profile.driver_id}</p>
              )}
            </div>
          </div>
        </div>

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
              onClick={() => navigate('/my-orders')}
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
                      {order.city || 'Unknown'}{order.province && ` • ${order.province}`}
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
