import { MapPin, ChevronRight, Package, Clock, Truck } from 'lucide-react';
import { Card } from '@/components/ui/card';
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
      return {
        label: 'Assigned',
        variant: 'secondary' as const,
        icon: Package
      };
    case 'CONFIRMED':
      return {
        label: 'Confirmed',
        variant: 'secondary' as const,
        icon: Package
      };
    case 'IN_ROUTE':
      return {
        label: 'In Transit',
        variant: 'default' as const,
        icon: Truck
      };
    case 'COMPLETED_DELIVERED':
      return {
        label: 'Delivered',
        variant: 'default' as const,
        icon: Package
      };
    case 'COMPLETED_INCOMPLETE':
      return {
        label: 'Incomplete',
        variant: 'destructive' as const,
        icon: Package
      };
    default:
      return {
        label: 'Pending',
        variant: 'outline' as const,
        icon: Clock
      };
  }
};

export function ActiveDeliveryCard({
  order,
  onClick
}: ActiveDeliveryCardProps) {
  const statusConfig = getStatusConfig(order.timeline_status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="bg-card border-border overflow-hidden">
      {/* Header with gradient accent */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <StatusIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Active Delivery</p>
              <p className="text-sm font-semibold text-foreground">{order.client_name || 'Customer'}</p>
            </div>
          </div>
          <Badge variant={statusConfig.variant}>
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Destination */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Destination</p>
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {order.address_line_1 || 'Address not available'}
            </p>
            {order.address_line_2 && <p className="text-sm text-muted-foreground">{order.address_line_2}</p>}
          </div>
        </div>

        {/* IDs in structured layout */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Shipment</p>
            <p className="text-xs font-mono font-medium text-foreground truncate">{order.shipment_id || '—'}</p>
          </div>
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tracking</p>
            <p className="text-xs font-mono font-medium text-foreground truncate">{order.tracking_id || '—'}</p>
          </div>
        </div>

        {/* Action Button */}
        <Button onClick={onClick} className="w-full" size="lg">
          View Details
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </Card>
  );
}
