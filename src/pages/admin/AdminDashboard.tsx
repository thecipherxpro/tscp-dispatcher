import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, Clock, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { ActiveDeliveryCard } from '@/components/orders/ActiveDeliveryCard';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  inRouteOrders: number;
  completedOrders: number;
  assignedOrders: number;
  totalDrivers: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    inRouteOrders: 0,
    completedOrders: 0,
    assignedOrders: 0,
    totalDrivers: 0,
  });
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [ordersResult, driversResult] = await Promise.all([
          supabase.from('orders').select('*'),
          supabase.from('user_roles').select('*').eq('role', 'driver'),
        ]);

        if (ordersResult.data) {
          const orders = ordersResult.data;
          
          // Find most recent active order (IN_ROUTE first, then CONFIRMED)
          const activeOrders = orders.filter(o => 
            o.timeline_status === 'IN_ROUTE' || 
            o.timeline_status === 'CONFIRMED' ||
            o.timeline_status === 'PICKED_UP_AND_ASSIGNED'
          ).sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
          
          setActiveOrder(activeOrders[0] as Order || null);
          
          setStats({
            totalOrders: orders.length,
            pendingOrders: orders.filter(o => o.timeline_status === 'PENDING').length,
            inRouteOrders: orders.filter(o => o.timeline_status === 'IN_ROUTE' || o.timeline_status === 'CONFIRMED').length,
            completedOrders: orders.filter(o => o.timeline_status === 'COMPLETED_DELIVERED' || o.timeline_status === 'COMPLETED_INCOMPLETE').length,
            assignedOrders: orders.filter(o => o.timeline_status === 'PICKED_UP_AND_ASSIGNED' || o.timeline_status === 'REVIEW_REQUESTED').length,
            totalDrivers: driversResult.data?.length || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Orders', value: stats.totalOrders, icon: Package, color: 'text-primary' },
    { label: 'Pending', value: stats.pendingOrders, icon: Clock, color: 'text-amber-500' },
    { label: 'In Route', value: stats.inRouteOrders, icon: Truck, color: 'text-blue-500' },
    { label: 'Completed', value: stats.completedOrders, icon: CheckCircle, color: 'text-green-500' },
    { label: 'Assigned', value: stats.assignedOrders, icon: AlertCircle, color: 'text-purple-500' },
    { label: 'Drivers', value: stats.totalDrivers, icon: Users, color: 'text-primary' },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="p-4 space-y-6">
        {/* Welcome Card */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 border-0 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-primary-foreground/70 text-sm">Welcome back,</p>
            <h2 className="text-xl font-bold text-primary-foreground">
              {profile?.full_name || 'Admin'}
            </h2>
          </CardContent>
        </Card>

        {/* Active Delivery Card */}
        {activeOrder && (
          <ActiveDeliveryCard 
            order={activeOrder} 
            onClick={() => navigate('/orders')}
          />
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-card border-border">
              <CardContent className="p-3 text-center">
                <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                <p className="text-xl font-bold text-foreground">
                  {isLoading ? '-' : stat.value}
                </p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className="bg-primary text-primary-foreground cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => navigate('/orders')}
            >
              <CardContent className="p-4 text-center">
                <Package className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm font-medium">Manage Orders</p>
              </CardContent>
            </Card>
            <Card 
              className="bg-secondary text-secondary-foreground cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => navigate('/track')}
            >
              <CardContent className="p-4 text-center">
                <Truck className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm font-medium">Track Shipment</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
