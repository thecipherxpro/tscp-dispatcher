import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, Clock, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  inRouteOrders: number;
  completedOrders: number;
  addressReviewOrders: number;
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
    addressReviewOrders: 0,
    totalDrivers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [ordersResult, driversResult] = await Promise.all([
          supabase.from('orders').select('timeline_status'),
          supabase.from('user_roles').select('*').eq('role', 'driver'),
        ]);

        if (ordersResult.data) {
          const orders = ordersResult.data;
          setStats({
            totalOrders: orders.length,
            pendingOrders: orders.filter(o => o.timeline_status === 'PENDING').length,
            inRouteOrders: orders.filter(o => o.timeline_status === 'IN_ROUTE').length,
            completedOrders: orders.filter(o => o.timeline_status === 'COMPLETED').length,
            addressReviewOrders: orders.filter(o => o.timeline_status === 'REQUEST_ADDRESS_REVIEW').length,
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
    { label: 'Pending', value: stats.pendingOrders, icon: Clock, color: 'text-yellow-500' },
    { label: 'In Route', value: stats.inRouteOrders, icon: Truck, color: 'text-blue-500' },
    { label: 'Completed', value: stats.completedOrders, icon: CheckCircle, color: 'text-green-500' },
    { label: 'Address Review', value: stats.addressReviewOrders, icon: AlertCircle, color: 'text-destructive' },
    { label: 'Active Drivers', value: stats.totalDrivers, icon: Users, color: 'text-accent-foreground' },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="p-4 space-y-6">
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-muted-foreground text-sm">Welcome back,</p>
          <h2 className="text-xl font-semibold text-foreground">
            {profile?.full_name || 'Admin'}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '-' : stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className="bg-primary text-primary-foreground cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => navigate('/orders')}
            >
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Manage Orders</p>
              </CardContent>
            </Card>
            <Card 
              className="bg-secondary text-secondary-foreground cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => navigate('/track')}
            >
              <CardContent className="p-4 text-center">
                <Truck className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Track Shipment</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
