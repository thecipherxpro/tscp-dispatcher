import { useEffect, useState } from 'react';
import { Package, Clock, Truck, CheckCircle, MapPin } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';

interface DriverStats {
  assignedOrders: number;
  inRouteOrders: number;
  completedToday: number;
}

export default function DriverDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DriverStats>({
    assignedOrders: 0,
    inRouteOrders: 0,
    completedToday: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .eq('assigned_driver_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (orders) {
          setRecentOrders(orders as Order[]);
          
          const today = new Date().toISOString().split('T')[0];
          setStats({
            assignedOrders: orders.filter(o => o.timeline_status !== 'COMPLETED').length,
            inRouteOrders: orders.filter(o => o.timeline_status === 'IN_ROUTE').length,
            completedToday: orders.filter(o => 
              o.timeline_status === 'COMPLETED' && 
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'IN_ROUTE': return 'bg-purple-100 text-purple-800';
      case 'ARRIVED': return 'bg-indigo-100 text-indigo-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDOB = (dob: string | null) => {
    if (!dob) return 'N/A';
    return new Date(dob).getFullYear().toString();
  };

  return (
    <AppLayout title="My Deliveries">
      <div className="p-4 space-y-6">
        <div className="bg-primary rounded-lg p-4 text-primary-foreground">
          <p className="text-primary-foreground/70 text-sm">Hello,</p>
          <h2 className="text-xl font-semibold">
            {profile?.full_name || 'Driver'}
          </h2>
          <p className="text-sm text-primary-foreground/70 mt-1">
            Ready for deliveries today?
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <Package className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold text-foreground">
                {isLoading ? '-' : stats.assignedOrders}
              </p>
              <p className="text-xs text-muted-foreground">Assigned</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <Truck className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-xl font-bold text-foreground">
                {isLoading ? '-' : stats.inRouteOrders}
              </p>
              <p className="text-xs text-muted-foreground">In Route</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <p className="text-xl font-bold text-foreground">
                {isLoading ? '-' : stats.completedToday}
              </p>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Orders</h3>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-lg p-4 border border-border animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No orders assigned yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Card key={order.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">
                          {order.name || 'Unknown Client'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          DOB Year: {formatDOB(order.dob)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.timeline_status)}`}>
                        {order.timeline_status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 mr-1" />
                      {order.city}, {order.province} {order.postal}
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
