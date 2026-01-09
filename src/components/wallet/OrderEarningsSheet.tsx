import { format } from 'date-fns';
import { Package, MapPin, Receipt, DollarSign, Route } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { DriverEarning, BASE_RATE, PER_KM_RATE } from '@/hooks/useDriverEarnings';

interface OrderEarningsSheetProps {
  earning: DriverEarning | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderEarningsSheet({ earning, open, onOpenChange }: OrderEarningsSheetProps) {
  if (!earning) return null;

  const formattedDate = format(new Date(earning.completed_at), 'MMMM d, yyyy');
  const formattedTime = format(new Date(earning.completed_at), 'h:mm a');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-left">
              #{earning.shipment_id || 'N/A'}
            </SheetTitle>
            <div className="text-right text-sm text-muted-foreground">
              <p>{formattedDate}</p>
              <p>{formattedTime}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto pb-8">
          {/* Order Summary */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Order ID</p>
                <p className="font-medium text-foreground text-sm">{earning.order_id.slice(0, 8)}...</p>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Route className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Distance</p>
                <p className="font-medium text-foreground text-sm">{earning.distance_km.toFixed(1)} km</p>
              </div>
            </div>
          </div>

          {/* Pay Calculation Receipt */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Pay Calculation</h3>
            </div>
            
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 space-y-3">
                {/* Base Rate */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">Base Rate</p>
                    <p className="text-xs text-muted-foreground">Per order completed</p>
                  </div>
                  <p className="font-medium text-foreground">${BASE_RATE.toFixed(2)}</p>
                </div>
                
                <Separator />
                
                {/* Distance Pay */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">Distance Pay</p>
                    <p className="text-xs text-muted-foreground">
                      {earning.distance_km.toFixed(1)} km × ${PER_KM_RATE.toFixed(2)}/km
                    </p>
                  </div>
                  <p className="font-medium text-foreground">${earning.distance_earnings.toFixed(2)}</p>
                </div>
              </div>
              
              {/* Total */}
              <div className="bg-primary/5 border-t border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <p className="font-bold text-foreground">Total Earnings</p>
                  </div>
                  <p className="text-xl font-bold text-primary">${earning.total_earnings.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payout Info */}
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-sm text-muted-foreground text-center">
              Status: <span className="font-medium text-foreground capitalize">{earning.payout_status}</span>
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
