import { useState, useEffect } from 'react';
import { Search, DollarSign, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { DriverPayrollCard } from '@/components/admin/payroll/DriverPayrollCard';
import { DriverPayrollSheet } from '@/components/admin/payroll/DriverPayrollSheet';

interface DriverWithPayoutInfo {
  id: string;
  full_name: string | null;
  driver_id: string | null;
  avatar_url: string | null;
  first_order_date: string | null;
}

export default function AdminPayroll() {
  const [drivers, setDrivers] = useState<DriverWithPayoutInfo[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<DriverWithPayoutInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<DriverWithPayoutInfo | null>(null);

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDrivers(drivers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredDrivers(drivers.filter(d => 
        d.full_name?.toLowerCase().includes(query) ||
        d.driver_id?.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, drivers]);

  const fetchDrivers = async () => {
    try {
      // Get all driver user IDs
      const { data: driverRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'driver');

      if (!driverRoles || driverRoles.length === 0) {
        setDrivers([]);
        setFilteredDrivers([]);
        setIsLoading(false);
        return;
      }

      const driverIds = driverRoles.map(r => r.user_id);

      // Get driver profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, driver_id, avatar_url')
        .in('id', driverIds);

      // Get first order date for each driver from payout settings
      const { data: payoutSettings } = await supabase
        .from('driver_payout_settings')
        .select('driver_id, first_order_completed_at')
        .in('driver_id', driverIds);

      // Get first order date from earnings if not in settings
      const { data: earnings } = await supabase
        .from('driver_earnings')
        .select('driver_id, completed_at')
        .in('driver_id', driverIds)
        .order('completed_at', { ascending: true });

      const driversWithPayoutInfo: DriverWithPayoutInfo[] = (profiles || []).map(p => {
        const settings = payoutSettings?.find(s => s.driver_id === p.id);
        const firstEarning = earnings?.find(e => e.driver_id === p.id);
        
        return {
          ...p,
          first_order_date: settings?.first_order_completed_at || firstEarning?.completed_at || null
        };
      });

      // Sort by name
      driversWithPayoutInfo.sort((a, b) => 
        (a.full_name || '').localeCompare(b.full_name || '')
      );

      setDrivers(driversWithPayoutInfo);
      setFilteredDrivers(driversWithPayoutInfo);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout title="Payroll">
      <div className="p-4 space-y-4">
        {/* Header Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-primary to-primary/80 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-primary-foreground/70 text-xs">Total Drivers</p>
                  <p className="text-2xl font-bold text-primary-foreground">{drivers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-xs">Active</p>
                  <p className="text-2xl font-bold text-white">
                    {drivers.filter(d => d.first_order_date).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or driver ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* Driver List */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredDrivers.length > 0 ? (
            filteredDrivers.map(driver => (
              <DriverPayrollCard
                key={driver.id}
                driver={driver}
                firstOrderDate={driver.first_order_date}
                onView={() => setSelectedDriver(driver)}
              />
            ))
          ) : (
            <Card className="bg-muted/30 border-border">
              <CardContent className="p-8 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No drivers found matching your search' : 'No drivers registered yet'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Driver Detail Sheet */}
      <DriverPayrollSheet
        open={!!selectedDriver}
        onOpenChange={(open) => !open && setSelectedDriver(null)}
        driver={selectedDriver}
      />
    </AppLayout>
  );
}
