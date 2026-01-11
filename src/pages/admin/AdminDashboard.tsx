import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, Clock, CheckCircle, AlertCircle, Users, UserCog, ArrowUpRight, TrendingUp } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AdminOffcanvasMenu } from '@/components/admin/AdminOffcanvasMenu';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    inRouteOrders: 0,
    completedOrders: 0,
    assignedOrders: 0,
    totalDrivers: 0,
  });
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
    { label: 'Total Orders', value: stats.totalOrders, icon: Package, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Pending', value: stats.pendingOrders, icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: 'In Route', value: stats.inRouteOrders, icon: Truck, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: 'Completed', value: stats.completedOrders, icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500/10' },
    { label: 'Assigned', value: stats.assignedOrders, icon: AlertCircle, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { label: 'Drivers', value: stats.totalDrivers, icon: Users, color: 'text-primary', bgColor: 'bg-primary/10' },
  ];

  const quickActions = [
    { label: 'Manage Orders', icon: Package, path: '/orders', variant: 'default' as const },
    { label: 'Track Shipment', icon: Truck, path: '/track', variant: 'secondary' as const },
    { label: 'User Management', icon: UserCog, path: '/users', variant: 'outline' as const },
    { label: 'View Drivers', icon: Users, path: '/drivers', variant: 'outline' as const },
  ];

  return (
    <AdminLayout title="Dashboard">
      <div className="p-4 md:p-6 lg:p-8 space-y-6 lg:space-y-8">
        {/* Welcome Card - Mobile shows offcanvas menu */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 border-0 overflow-hidden">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-primary-foreground/70 text-sm">Welcome back,</p>
                <h2 className="text-xl md:text-2xl font-bold text-primary-foreground">
                  {profile?.full_name || 'Admin'}
                </h2>
                <Badge variant="secondary" className="mt-2 bg-primary-foreground/20 text-primary-foreground border-0">
                  Admin Portal
                </Badge>
              </div>
              {/* Only show offcanvas menu on mobile */}
              {isMobile && <AdminOffcanvasMenu />}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid - Responsive */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 hidden md:block">Overview</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
            {statCards.map((stat) => (
              <Card key={stat.label} className="bg-card border-border">
                <CardContent className="p-3 md:p-4 text-center">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg ${stat.bgColor} flex items-center justify-center mx-auto mb-2`}>
                    <stat.icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.color}`} />
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-foreground">
                    {isLoading ? '-' : stat.value}
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions - Responsive */}
        <div className="space-y-3 md:space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {quickActions.map((action) => (
              <Card 
                key={action.label}
                className={`cursor-pointer hover:shadow-md transition-all ${
                  action.variant === 'default' ? 'bg-primary text-primary-foreground' :
                  action.variant === 'secondary' ? 'bg-secondary text-secondary-foreground' :
                  'bg-card border-border hover:bg-muted/50'
                }`}
                onClick={() => navigate(action.path)}
              >
                <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center gap-2 md:gap-3">
                  <action.icon className="w-6 h-6 md:w-8 md:h-8" />
                  <p className="text-sm md:text-base font-medium text-center">{action.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Desktop: Additional Stats Cards */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                Delivery Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Completion Rate</span>
                  <span className="text-lg font-semibold text-foreground">
                    {stats.totalOrders > 0 
                      ? Math.round((stats.completedOrders / stats.totalOrders) * 100) 
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${stats.totalOrders > 0 ? (stats.completedOrders / stats.totalOrders) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{stats.completedOrders} completed</span>
                  <span>{stats.totalOrders} total</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Active Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-amber-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-sm">Pending</span>
                  </div>
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">
                    {stats.pendingOrders}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">In Route</span>
                  </div>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-600">
                    {stats.inRouteOrders}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-purple-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">Assigned</span>
                  </div>
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-600">
                    {stats.assignedOrders}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
