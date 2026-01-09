import { useState } from 'react';
import { format } from 'date-fns';
import { 
  Calendar, 
  Package, 
  Route, 
  DollarSign, 
  Calculator,
  Check,
  Download,
  FileText
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BASE_RATE, PER_KM_RATE } from '@/hooks/useDriverEarnings';

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

interface PayoutDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payout: PayoutPeriod | null;
  driverName: string;
  onPayoutUpdated?: () => void;
}

export function PayoutDetailSheet({ 
  open, 
  onOpenChange, 
  payout,
  driverName,
  onPayoutUpdated
}: PayoutDetailSheetProps) {
  const [isMarking, setIsMarking] = useState(false);

  if (!payout) return null;

  const baseEarnings = payout.totalOrders * BASE_RATE;
  const distanceEarnings = payout.totalDistance * PER_KM_RATE;

  const handleMarkPaid = async () => {
    setIsMarking(true);
    try {
      // Create or update pay stub
      const { error } = await supabase
        .from('driver_pay_stubs')
        .upsert({
          driver_id: payout.driverId,
          period_start: format(payout.start, 'yyyy-MM-dd'),
          period_end: format(payout.end, 'yyyy-MM-dd'),
          total_orders: payout.totalOrders,
          total_distance_km: payout.totalDistance,
          total_earnings: payout.totalEarnings,
          is_auto_generated: false,
          stub_data: {
            paidAt: new Date().toISOString(),
            isPaid: true,
            driverName,
            baseRate: BASE_RATE,
            perKmRate: PER_KM_RATE,
          }
        }, {
          onConflict: 'driver_id,period_start,period_end'
        });

      if (error) throw error;

      // Update earnings records for this period
      await supabase
        .from('driver_earnings')
        .update({ payout_status: 'paid' })
        .eq('driver_id', payout.driverId)
        .gte('completed_at', payout.start.toISOString())
        .lte('completed_at', payout.end.toISOString());

      toast.success('Payout marked as paid and receipt created');
      onPayoutUpdated?.();
    } catch (error) {
      console.error('Error marking payout as paid:', error);
      toast.error('Failed to mark payout as paid');
    } finally {
      setIsMarking(false);
    }
  };

  const handleDownloadReceipt = () => {
    // Create a simple receipt content
    const receiptContent = `
=====================================
         PAYOUT RECEIPT
=====================================

Driver: ${driverName}
Period: ${format(payout.start, 'MMM dd, yyyy')} - ${format(payout.end, 'MMM dd, yyyy')}

-------------------------------------
EARNINGS BREAKDOWN
-------------------------------------

Base Rate (${payout.totalOrders} deliveries × $${BASE_RATE.toFixed(2)}):
                              $${baseEarnings.toFixed(2)}

Distance (${payout.totalDistance.toFixed(1)} km × $${PER_KM_RATE.toFixed(2)}):
                              $${distanceEarnings.toFixed(2)}

-------------------------------------
TOTAL PAYOUT:                $${payout.totalEarnings.toFixed(2)}
-------------------------------------

Status: ${payout.isPaid ? 'PAID' : 'PENDING'}
${payout.paidAt ? `Paid On: ${format(new Date(payout.paidAt), 'MMM dd, yyyy')}` : ''}

=====================================
    Thank you for your service!
=====================================
    `.trim();

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-receipt-${format(payout.start, 'yyyyMMdd')}-${format(payout.end, 'yyyyMMdd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Receipt downloaded');
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-lg text-foreground">Payout Details</DrawerTitle>
              <p className="text-sm text-muted-foreground mt-1">{driverName}</p>
            </div>
            {payout.isPaid && (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                <Check className="w-3 h-3 mr-1" />
                Paid
              </Badge>
            )}
          </div>
        </DrawerHeader>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Period Info */}
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payout Period</p>
                  <p className="font-semibold text-foreground">
                    {format(payout.start, 'MMM dd')} - {format(payout.end, 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Package className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-foreground">{payout.totalOrders}</p>
                <p className="text-xs text-muted-foreground">Deliveries</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Route className="w-5 h-5 mx-auto mb-2 text-orange-500" />
                <p className="text-2xl font-bold text-foreground">{payout.totalDistance.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Total KM</p>
              </CardContent>
            </Card>
          </div>

          {/* Calculation Breakdown */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                Earnings Calculation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <div>
                  <p className="text-sm text-foreground">Base Rate</p>
                  <p className="text-xs text-muted-foreground">
                    {payout.totalOrders} deliveries × ${BASE_RATE.toFixed(2)}
                  </p>
                </div>
                <p className="font-medium text-foreground">${baseEarnings.toFixed(2)}</p>
              </div>
              <Separator />
              <div className="flex justify-between items-center py-2">
                <div>
                  <p className="text-sm text-foreground">Distance Bonus</p>
                  <p className="text-xs text-muted-foreground">
                    {payout.totalDistance.toFixed(1)} km × ${PER_KM_RATE.toFixed(2)}
                  </p>
                </div>
                <p className="font-medium text-foreground">${distanceEarnings.toFixed(2)}</p>
              </div>
              <Separator />
              <div className="flex justify-between items-center py-2 bg-primary/5 -mx-4 px-4 rounded-b-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <p className="font-semibold text-foreground">Total Payout</p>
                </div>
                <p className="text-xl font-bold text-green-600">${payout.totalEarnings.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!payout.isPaid ? (
              <Button 
                className="flex-1" 
                onClick={handleMarkPaid}
                disabled={isMarking}
              >
                <Check className="w-4 h-4 mr-2" />
                {isMarking ? 'Processing...' : 'Mark Paid & Create Receipt'}
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleDownloadReceipt}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Receipt
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
