import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Package, Receipt, DollarSign, Route, Calendar, Clock, CheckCircle } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { DriverEarning, BASE_RATE, PER_KM_RATE } from '@/hooks/useDriverEarnings';
import { supabase } from '@/integrations/supabase/client';

interface OrderEarningsSheetProps {
  earning: DriverEarning | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrderDetails {
  geo_zone: string | null;
  country: string | null;
}

export function OrderEarningsSheet({ earning, open, onOpenChange }: OrderEarningsSheetProps) {
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);

  useEffect(() => {
    if (!earning || !open) return;
    
    const fetchOrderDetails = async () => {
      const { data } = await supabase
        .from('orders')
        .select('geo_zone, country')
        .eq('id', earning.order_id)
        .maybeSingle();
      
      if (data) {
        setOrderDetails(data);
      }
    };
    
    fetchOrderDetails();
  }, [earning, open]);

  if (!earning) return null;

  const formattedDate = format(new Date(earning.completed_at), 'EEEE, MMMM d, yyyy');
  const formattedTime = format(new Date(earning.completed_at), 'h:mm a');

  // Format location - show city and province/country
  const locationDisplay = orderDetails?.geo_zone 
    ? `${orderDetails.geo_zone}${orderDetails.country ? `, ${orderDetails.country}` : ''}`
    : 'Location not available';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        {/* Drag Handle */}
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted-foreground/20 my-3" />
        
        <DrawerHeader className="pb-2 pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <DrawerTitle className="text-left text-lg">
                  Delivery Completed
                </DrawerTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  #{earning.shipment_id || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </DrawerHeader>

        <div className="px-4 pb-8 space-y-5 overflow-y-auto">
          {/* Order Details Section */}
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Order Details
            </h3>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {/* Date */}
              <div className="flex items-center gap-3 p-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium text-foreground text-sm">{formattedDate}</p>
                </div>
              </div>
              
              {/* Time */}
              <div className="flex items-center gap-3 p-3">
                <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Time of Delivery</p>
                  <p className="font-medium text-foreground text-sm">{formattedTime}</p>
                </div>
              </div>

              {/* Distance */}
              <div className="flex items-center gap-3 p-3">
                <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Route className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Total Distance</p>
                  <p className="font-medium text-foreground text-sm">{earning.distance_km.toFixed(1)} km</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pay Calculation Section */}
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pay Breakdown
            </h3>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 space-y-3">
                {/* Base Rate */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">Base Rate</p>
                    <p className="text-xs text-muted-foreground">Per completed delivery</p>
                  </div>
                  <p className="font-semibold text-foreground">${BASE_RATE.toFixed(2)}</p>
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
                  <p className="font-semibold text-foreground">${earning.distance_earnings.toFixed(2)}</p>
                </div>
              </div>
              
              {/* Total */}
              <div className="bg-primary/5 border-t border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <p className="font-bold text-foreground">Total Earned</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">${earning.total_earnings.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payout Status */}
          <div className="bg-muted/30 rounded-xl p-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-sm text-muted-foreground">
              Payout Status: <span className="font-medium text-foreground capitalize">{earning.payout_status}</span>
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}