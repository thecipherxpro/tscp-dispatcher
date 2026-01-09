import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Calendar, DollarSign, Package, Route, FileText, Loader2, Download } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useDriverEarnings, usePayoutSettings, usePayStubs, getPayoutPeriod, PAYOUT_INTERVAL_DAYS } from '@/hooks/useDriverEarnings';
import { toast } from 'sonner';
interface EarningsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
export function EarningsSheet({
  open,
  onOpenChange
}: EarningsSheetProps) {
  const {
    earnings,
    summary,
    isLoading
  } = useDriverEarnings();
  const {
    settings
  } = usePayoutSettings();
  const {
    stubs,
    generateStub,
    isLoading: stubsLoading
  } = usePayStubs();
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculate payout period
  const firstOrderDate = settings?.first_order_completed_at ? new Date(settings.first_order_completed_at) : earnings.length > 0 ? new Date(earnings[earnings.length - 1].completed_at) : null;
  const payoutPeriod = getPayoutPeriod(firstOrderDate);

  // Calculate current period stats
  const currentPeriodEarnings = payoutPeriod ? earnings.filter(e => {
    const date = new Date(e.completed_at);
    return date >= payoutPeriod.start && date <= addDays(payoutPeriod.end, 1);
  }) : [];
  const periodTotalEarnings = currentPeriodEarnings.reduce((sum, e) => sum + e.total_earnings, 0);
  const periodTotalOrders = currentPeriodEarnings.length;
  const periodTotalDistance = currentPeriodEarnings.reduce((sum, e) => sum + e.distance_km, 0);
  const progressPercentage = payoutPeriod ? (PAYOUT_INTERVAL_DAYS - payoutPeriod.daysRemaining) / PAYOUT_INTERVAL_DAYS * 100 : 0;
  const handleGenerateStub = async () => {
    if (!payoutPeriod) return;
    setIsGenerating(true);
    const result = await generateStub(payoutPeriod.start, payoutPeriod.end);
    setIsGenerating(false);
    if (result.success) {
      toast.success('Pay stub generated successfully');
    } else {
      toast.error('Failed to generate pay stub: ' + result.error);
    }
  };
  return <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Earnings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto pb-8">
          {/* Current Pay Period */}
          {payoutPeriod && <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">Current Pay Period</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {payoutPeriod.daysRemaining} days left
                </span>
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                {format(payoutPeriod.start, 'MMM d')} - {format(payoutPeriod.end, 'MMM d, yyyy')}
              </p>
              
              <Progress value={progressPercentage} className="h-2 mb-3" />
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Next Payout:</span>
                <span className="text-sm font-semibold text-primary">
                  {format(payoutPeriod.nextPayoutDate, 'MMM d, yyyy')}
                </span>
              </div>
            </div>}

          {/* Period Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/10 mx-auto mb-2 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <p className="font-bold text-foreground text-xl">${periodTotalEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Earnings</p>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 mx-auto mb-2 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <p className="font-bold text-foreground text-xl">{periodTotalOrders}</p>
              <p className="text-xs text-muted-foreground">Orders Completed</p>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 mx-auto mb-2 flex items-center justify-center">
                <Route className="w-5 h-5 text-purple-500" />
              </div>
              <p className="font-bold text-foreground text-xl">{periodTotalDistance.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Total Kilometers</p>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 mx-auto mb-2 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-500" />
              </div>
              <p className="font-bold text-foreground text-xl">{PAYOUT_INTERVAL_DAYS}</p>
              <p className="text-xs text-muted-foreground">Day Interval</p>
            </div>
          </div>

          <Separator />

          {/* Pay Stubs Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Pay Stubs</h3>
              </div>
              <Button variant="outline" size="sm" onClick={handleGenerateStub} disabled={isGenerating || !payoutPeriod}>
                {isGenerating ? <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Generating...
                  </> : <>
                    <Download className="w-4 h-4 mr-1" />
                    Generate Now
                  </>}
              </Button>
            </div>

            {stubsLoading ? <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div> : stubs.length === 0 ? <div className="text-center py-8 bg-muted/30 rounded-xl">
                <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No pay stubs yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate one or wait for automatic generation at the end of pay period
                </p>
              </div> : <div className="space-y-2">
                {stubs.map(stub => <div key={stub.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {format(new Date(stub.period_start), 'MMM d')} - {format(new Date(stub.period_end), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stub.total_orders} orders • {stub.total_distance_km?.toFixed(1)} km
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-primary">${stub.total_earnings?.toFixed(2)}</p>
                      {stub.is_auto_generated && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Auto
                        </span>}
                    </div>
                  </div>)}
              </div>}
          </div>
        </div>
      </SheetContent>
    </Sheet>;
}