import { Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Order } from '@/types/auth';

interface ActiveDeliveryCardProps {
  order: Order;
  onClick?: () => void;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'PICKED_UP_AND_ASSIGNED':
      return { label: 'Assigned', variant: 'secondary' as const, className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
    case 'CONFIRMED':
      return { label: 'Confirmed', variant: 'secondary' as const, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
    case 'IN_ROUTE':
      return { label: 'In Transit', variant: 'default' as const, className: 'bg-primary/10 text-primary border-primary/20' };
    case 'COMPLETED_DELIVERED':
      return { label: 'Delivered', variant: 'outline' as const, className: 'bg-green-500/10 text-green-600 border-green-500/20' };
    case 'COMPLETED_INCOMPLETE':
      return { label: 'Incomplete', variant: 'outline' as const, className: 'bg-destructive/10 text-destructive border-destructive/20' };
    default:
      return { label: 'Pending', variant: 'secondary' as const, className: 'bg-muted text-muted-foreground' };
  }
};

const getTimelineProgress = (status: string): number => {
  switch (status) {
    case 'PENDING': return 0;
    case 'PICKED_UP_AND_ASSIGNED': return 1;
    case 'CONFIRMED': return 2;
    case 'IN_ROUTE': return 3;
    case 'COMPLETED_DELIVERED':
    case 'COMPLETED_INCOMPLETE': return 4;
    default: return 0;
  }
};

export function ActiveDeliveryCard({ order, onClick }: ActiveDeliveryCardProps) {
  const statusConfig = getStatusConfig(order.timeline_status);
  const progress = getTimelineProgress(order.timeline_status);
  const steps = 4;

  return (
    <Card 
      className="bg-card border-border overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300"
      onClick={onClick}
    >
      <CardContent className="p-0">
        {/* Header with gradient accent */}
        <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-4 py-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Active Delivery</span>
            </div>
            <Badge variant={statusConfig.variant} className={statusConfig.className}>
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* IDs Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Shipping ID</p>
              <p className="text-sm font-semibold text-foreground font-mono">
                {order.shipment_id || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tracking ID</p>
              <p className="text-sm font-semibold text-foreground font-mono">
                {order.tracking_id || '—'}
              </p>
            </div>
          </div>

          {/* Timeline Progress */}
          <div className="pt-2">
            <div className="flex items-center justify-between">
              {Array.from({ length: steps }).map((_, index) => (
                <div key={index} className="flex items-center flex-1 last:flex-none">
                  {/* Dot */}
                  <div className="relative">
                    <div 
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${
                        index < progress 
                          ? 'bg-primary border-primary' 
                          : index === progress 
                            ? 'bg-primary border-primary ring-4 ring-primary/20' 
                            : 'bg-muted border-muted-foreground/30'
                      }`}
                    />
                    {/* Pulse animation for current step */}
                    {index === progress && progress < steps && (
                      <div className="absolute inset-0 w-3.5 h-3.5 rounded-full bg-primary animate-ping opacity-40" />
                    )}
                  </div>
                  {/* Connecting line */}
                  {index < steps - 1 && (
                    <div 
                      className={`flex-1 h-0.5 mx-1 transition-all duration-300 ${
                        index < progress 
                          ? 'bg-primary' 
                          : 'bg-muted-foreground/20'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            {/* Step labels */}
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">Pickup</span>
              <span className="text-[10px] text-muted-foreground">Confirm</span>
              <span className="text-[10px] text-muted-foreground">Transit</span>
              <span className="text-[10px] text-muted-foreground">Done</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
