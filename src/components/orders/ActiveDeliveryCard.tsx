import { MapPin, ChevronRight, Navigation } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Order } from '@/types/auth';

interface ActiveDeliveryCardProps {
  order: Order;
  onClick?: () => void;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'PICKED_UP_AND_ASSIGNED':
      return { label: 'Assigned', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
    case 'CONFIRMED':
      return { label: 'Confirmed', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
    case 'IN_ROUTE':
      return { label: 'In Transit', className: 'bg-primary/10 text-primary border-primary/20' };
    case 'COMPLETED_DELIVERED':
      return { label: 'Delivered', className: 'bg-green-500/10 text-green-600 border-green-500/20' };
    case 'COMPLETED_INCOMPLETE':
      return { label: 'Incomplete', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    default:
      return { label: 'Pending', className: 'bg-muted text-muted-foreground' };
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

  const fullAddress = [
    order.address_1,
    order.address_2,
    order.city,
    order.province,
    order.postal
  ].filter(Boolean).join(', ');

  return (
    <Card 
      className="bg-card border-border overflow-hidden"
    >
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Current Delivery</span>
          </div>
          <Badge variant="outline" className={statusConfig.className}>
            {statusConfig.label}
          </Badge>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Address Section - Primary Focus */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Destination</p>
              <p className="text-sm font-medium text-foreground leading-snug">
                {fullAddress || 'Address not available'}
              </p>
            </div>
          </div>

          {/* IDs Row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="font-mono">{order.shipment_id || '—'}</span>
            <span>•</span>
            <span className="font-mono">{order.tracking_id || '—'}</span>
          </div>

          {/* Timeline Progress - Compact */}
          <div className="pt-1">
            <div className="flex items-center gap-1">
              {Array.from({ length: steps }).map((_, index) => (
                <div 
                  key={index} 
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    index < progress 
                      ? 'bg-primary' 
                      : index === progress 
                        ? 'bg-primary/50' 
                        : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Navigate Button */}
          <Button 
            onClick={onClick}
            className="w-full"
            size="lg"
          >
            <Navigation className="w-4 h-4 mr-2" />
            View Delivery Details
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
