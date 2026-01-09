import { useState, useEffect } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { 
  User, 
  Package, 
  XCircle, 
  Clock, 
  CreditCard, 
  Copy,
  ChevronDown,
  ChevronUp,
  Building2,
  Mail
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PAYOUT_INTERVAL_DAYS, DriverEarning } from '@/hooks/useDriverEarnings';
import { PayoutPeriodCard } from './PayoutPeriodCard';
import { PayoutDetailSheet } from './PayoutDetailSheet';

interface DriverProfile {
  id: string;
  full_name: string | null;
  driver_id: string | null;
  avatar_url: string | null;
}

interface PayoutSettings {
  payout_method: string | null;
  e_transfer_email: string | null;
  auto_deposit: boolean | null;
  security_question: string | null;
  security_answer: string | null;
  bank_name: string | null;
  institution_number: string | null;
  transit_number: string | null;
  account_number: string | null;
  institution_name: string | null;
  legal_name: string | null;
}

interface OrderStats {
  total: number;
  completed: number;
  cancelled: number;
  pending: number;
}

interface PayoutPeriod {
  id?: string;
  start: Date;
  end: Date;
  totalOrders: number;
  totalDistance: number;
  totalEarnings: number;
  isPaid: boolean;
  paidAt?: string;
  driverId: string;
}

interface DriverPayrollSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: DriverProfile | null;
}

export function DriverPayrollSheet({ open, onOpenChange, driver }: DriverPayrollSheetProps) {
  const [payoutSettings, setPayoutSettings] = useState<PayoutSettings | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats>({ total: 0, completed: 0, cancelled: 0, pending: 0 });
  const [payoutPeriods, setPayoutPeriods] = useState<PayoutPeriod[]>([]);
  const [payStubs, setPayStubs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payoutMethodOpen, setPayoutMethodOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<PayoutPeriod | null>(null);

  useEffect(() => {
    if (driver && open) {
      fetchDriverData();
    }
  }, [driver, open]);

  const fetchDriverData = async () => {
    if (!driver) return;
    setIsLoading(true);

    try {
      // Fetch payout settings
      const { data: settings } = await supabase
        .from('driver_payout_settings')
        .select('*')
        .eq('driver_id', driver.id)
        .maybeSingle();
      
      setPayoutSettings(settings);

      // Fetch order stats
      const { data: orders } = await supabase
        .from('orders')
        .select('timeline_status')
        .eq('assigned_driver_id', driver.id);
      
      if (orders) {
        const completed = orders.filter(o => 
          o.timeline_status === 'COMPLETED_DELIVERED' || 
          o.timeline_status === 'COMPLETED_INCOMPLETE'
        ).length;
        const cancelled = orders.filter(o => 
          o.timeline_status === 'COMPLETED_INCOMPLETE'
        ).length;
        const pending = orders.filter(o => 
          o.timeline_status !== 'COMPLETED_DELIVERED' && 
          o.timeline_status !== 'COMPLETED_INCOMPLETE'
        ).length;
        
        setOrderStats({
          total: orders.length,
          completed,
          cancelled,
          pending
        });
      }

      // Fetch pay stubs
      const { data: stubs } = await supabase
        .from('driver_pay_stubs')
        .select('*')
        .eq('driver_id', driver.id)
        .order('period_end', { ascending: false });
      
      setPayStubs(stubs || []);

      // Fetch earnings and calculate payout periods
      const { data: earnings } = await supabase
        .from('driver_earnings')
        .select('*')
        .eq('driver_id', driver.id)
        .order('completed_at', { ascending: true });
      
      if (earnings && earnings.length > 0) {
        const periods = calculatePayoutPeriods(earnings as DriverEarning[], stubs || [], driver.id);
        setPayoutPeriods(periods);
      }

    } catch (error) {
      console.error('Error fetching driver data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePayoutPeriods = (earnings: DriverEarning[], stubs: any[], driverId: string): PayoutPeriod[] => {
    if (earnings.length === 0) return [];

    const firstEarning = new Date(earnings[0].completed_at);
    const startDate = startOfDay(firstEarning);
    const now = new Date();
    const periods: PayoutPeriod[] = [];

    let periodStart = startDate;
    
    while (periodStart <= now) {
      const periodEnd = addDays(periodStart, PAYOUT_INTERVAL_DAYS - 1);
      
      const periodEarnings = earnings.filter(e => {
        const date = new Date(e.completed_at);
        return date >= periodStart && date <= periodEnd;
      });

      const totalOrders = periodEarnings.length;
      const totalDistance = periodEarnings.reduce((sum, e) => sum + (e.distance_km || 0), 0);
      const totalEarnings = periodEarnings.reduce((sum, e) => sum + (e.total_earnings || 0), 0);

      // Check if this period has a pay stub (is paid)
      const stub = stubs.find(s => {
        const stubStart = new Date(s.period_start);
        const stubEnd = new Date(s.period_end);
        return stubStart.getTime() === periodStart.getTime() || 
               (stubStart <= periodStart && stubEnd >= periodEnd);
      });

      if (totalOrders > 0) {
        periods.push({
          start: periodStart,
          end: periodEnd,
          totalOrders,
          totalDistance,
          totalEarnings,
          isPaid: !!stub?.stub_data?.isPaid,
          paidAt: stub?.stub_data?.paidAt,
          driverId
        });
      }

      periodStart = addDays(periodStart, PAYOUT_INTERVAL_DAYS);
    }

    return periods.reverse();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'D';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPayoutMethodLabel = () => {
    if (!payoutSettings?.payout_method) return 'Not Set';
    switch (payoutSettings.payout_method) {
      case 'e_transfer':
        return 'Interac e-Transfer';
      case 'direct_deposit':
        return 'Direct Deposit';
      default:
        return payoutSettings.payout_method;
    }
  };

  if (!driver) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b border-border pb-4">
            <DrawerTitle className="text-lg text-foreground">Driver Details</DrawerTitle>
          </DrawerHeader>

          <div className="p-4 space-y-4 overflow-y-auto">
            {/* Driver Profile Card */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-primary/30">
                    <AvatarImage src={driver.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                      {getInitials(driver.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {driver.full_name || 'Unknown Driver'}
                    </h3>
                    <Badge variant="outline" className="mt-1">
                      {driver.driver_id || 'No ID'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-card border-border">
                <CardContent className="p-3 text-center">
                  <Package className="w-5 h-5 mx-auto mb-1 text-green-500" />
                  <p className="text-xl font-bold text-foreground">{orderStats.completed}</p>
                  <p className="text-[10px] text-muted-foreground">Completed</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3 text-center">
                  <XCircle className="w-5 h-5 mx-auto mb-1 text-red-500" />
                  <p className="text-xl font-bold text-foreground">{orderStats.cancelled}</p>
                  <p className="text-[10px] text-muted-foreground">Incomplete</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3 text-center">
                  <Clock className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                  <p className="text-xl font-bold text-foreground">{orderStats.pending}</p>
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                </CardContent>
              </Card>
            </div>

            {/* Payout Method - Collapsible */}
            <Collapsible open={payoutMethodOpen} onOpenChange={setPayoutMethodOpen}>
              <Card className="bg-card border-border">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-primary" />
                        Payout Method
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {getPayoutMethodLabel()}
                        </Badge>
                        {payoutMethodOpen ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-3">
                    <Separator />
                    {payoutSettings?.payout_method === 'e_transfer' && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Email</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {payoutSettings.e_transfer_email || '-'}
                            </span>
                            {payoutSettings.e_transfer_email && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(payoutSettings.e_transfer_email!, 'Email')}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Auto-Deposit</span>
                          <Badge variant={payoutSettings.auto_deposit ? 'default' : 'secondary'}>
                            {payoutSettings.auto_deposit ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        {!payoutSettings.auto_deposit && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Security Question</span>
                              <span className="text-sm text-foreground text-right max-w-[150px] truncate">
                                {payoutSettings.security_question || '-'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Answer</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  {payoutSettings.security_answer || '-'}
                                </span>
                                {payoutSettings.security_answer && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6"
                                    onClick={() => copyToClipboard(payoutSettings.security_answer!, 'Answer')}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                    {payoutSettings?.payout_method === 'direct_deposit' && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Bank</span>
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {payoutSettings.bank_name || payoutSettings.institution_name || '-'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Institution #</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {payoutSettings.institution_number || '-'}
                            </span>
                            {payoutSettings.institution_number && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(payoutSettings.institution_number!, 'Institution #')}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Transit #</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {payoutSettings.transit_number || '-'}
                            </span>
                            {payoutSettings.transit_number && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(payoutSettings.transit_number!, 'Transit #')}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Account #</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {payoutSettings.account_number ? `****${payoutSettings.account_number.slice(-4)}` : '-'}
                            </span>
                            {payoutSettings.account_number && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(payoutSettings.account_number!, 'Account #')}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                    {!payoutSettings?.payout_method && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No payout method configured
                      </p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Payout History */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground px-1">Payout History</h3>
              {payoutPeriods.length > 0 ? (
                <div className="space-y-2">
                  {payoutPeriods.map((period, index) => (
                    <PayoutPeriodCard
                      key={index}
                      start={period.start}
                      end={period.end}
                      amount={period.totalEarnings}
                      isPaid={period.isPaid}
                      onView={() => setSelectedPayout(period)}
                    />
                  ))}
                </div>
              ) : (
                <Card className="bg-muted/30 border-border">
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground text-sm">No payout history yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Payout Detail Sheet */}
      <PayoutDetailSheet
        open={!!selectedPayout}
        onOpenChange={(open) => !open && setSelectedPayout(null)}
        payout={selectedPayout}
        driverName={driver.full_name || 'Driver'}
        onPayoutUpdated={fetchDriverData}
      />
    </>
  );
}
