import { MapPin, Calendar, Package, User, Eye, FileDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Order } from '@/types/auth';
import { format } from 'date-fns';
import { PackageLabel } from './PackageLabel';

interface OrderCardProps {
  order: Order;
  onClick: () => void;
  isDriver?: boolean;
  actionButton?: React.ReactNode;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'PENDING':
      return { 
        label: 'Pending', 
        variant: 'outline' as const,
        className: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      };
    case 'PICKED_UP_AND_ASSIGNED':
      return { 
        label: 'Assigned', 
        variant: 'outline' as const,
        className: 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400'
      };
    case 'REVIEW_REQUESTED':
      return { 
        label: 'Review Requested', 
        variant: 'outline' as const,
        className: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      };
    case 'CONFIRMED':
      return { 
        label: 'Confirmed', 
        variant: 'outline' as const,
        className: 'border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
      };
    case 'IN_ROUTE':
      return { 
        label: 'In Route', 
        variant: 'outline' as const,
        className: 'border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-400'
      };
    case 'COMPLETED_DELIVERED':
      return { 
        label: 'Delivered', 
        variant: 'outline' as const,
        className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      };
    case 'COMPLETED_INCOMPLETE':
      return { 
        label: 'Incomplete', 
        variant: 'outline' as const,
        className: 'border-destructive/50 bg-destructive/10 text-destructive'
      };
    default:
      return { 
        label: status, 
        variant: 'outline' as const,
        className: 'border-muted-foreground/30 bg-muted text-muted-foreground'
      };
  }
};

const getFullAddress = (order: Order) => {
  const parts = [order.address_line_1, order.address_line_2].filter(Boolean);
  return parts.join(', ');
};

export function OrderCard({ order, onClick, isDriver = false, actionButton }: OrderCardProps) {
  const statusConfig = getStatusConfig(order.timeline_status);
  const hasAddress = order.address_line_1;
  const orderDate = order.order_date ? new Date(order.order_date + 'T00:00:00') : null;

  return (
    <Card 
      className="bg-card border-border overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-150 hover:shadow-md hover:border-primary/30"
      onClick={onClick}
    >
      {/* Header - Name & Status */}
      <div className="flex items-center justify-between gap-3 p-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate text-sm leading-tight">
              {order.client_name || 'Unknown Client'}
            </p>
            {!isDriver && order.email && (
              <p className="text-xs text-muted-foreground truncate">
                {order.email}
              </p>
            )}
          </div>
        </div>
        <Badge variant={statusConfig.variant} className={`${statusConfig.className} text-[10px] font-medium flex-shrink-0`}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Content - Structured Details */}
      <div className="p-3 space-y-2">
        {/* Order Date */}
        {orderDate && (
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Order:</span>
            <span className="text-xs font-medium text-foreground">
              {format(orderDate, 'MMM d, yyyy')}
            </span>
          </div>
        )}

        {/* Address */}
        {hasAddress && (
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="text-xs text-foreground line-clamp-2">
              {isDriver ? getFullAddress(order) : order.address_line_1}
            </span>
          </div>
        )}

        {/* Shipment ID - Admin only */}
        {!isDriver && (
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Shipment:</span>
            {order.shipment_id ? (
              <span className="font-mono text-xs font-medium text-primary">
                {order.shipment_id}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/60 italic">
                Not assigned
              </span>
            )}
          </div>
        )}

        {/* Action Button (for driver) */}
        {actionButton && (
          <div className="pt-1">
            {actionButton}
          </div>
        )}

        {/* View Order Button - Admin only */}
        {!isDriver && !actionButton && (
          <div className="pt-2 flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              View Order
            </Button>
            <div onClick={(e) => e.stopPropagation()}>
              <PackageLabel order={order} variant="icon" />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
