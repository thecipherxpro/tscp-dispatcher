import { MapPin, Clock, Package, User, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Order } from '@/types/auth';
import { format } from 'date-fns';

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

// Extract city from warehouse_address for display
const getCityFromWarehouse = (warehouseAddress: string | null) => {
  if (!warehouseAddress) return null;
  // Warehouse address format might be: "123 Street, City, Province"
  const parts = warehouseAddress.split(',').map(p => p.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
};

export function OrderCard({ order, onClick, isDriver = false, actionButton }: OrderCardProps) {
  const statusConfig = getStatusConfig(order.timeline_status);
  const hasAddress = order.address_line_1 || order.warehouse_address;
  const orderDate = order.order_date ? new Date(order.order_date) : null;
  const displayCity = getCityFromWarehouse(order.warehouse_address);

  return (
    <Card 
      className="bg-card border-border overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-150 hover:shadow-md hover:border-primary/30"
      onClick={onClick}
    >
      <div className="p-4">
        {/* Header Row - Name and Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate leading-tight">
                {order.client_name || 'Unknown Client'}
              </p>
              {/* Email only for admin, not for driver */}
              {!isDriver && order.email && (
                <p className="text-xs text-muted-foreground truncate">
                  {order.email}
                </p>
              )}
            </div>
          </div>
          <Badge variant={statusConfig.variant} className={`${statusConfig.className} text-xs font-medium flex-shrink-0`}>
            {statusConfig.label}
          </Badge>
        </div>

        {/* Details Grid */}
        <div className="space-y-2 pl-[46px]">
          {/* Location - Full address for drivers, partial for admin */}
          {hasAddress && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">
                {isDriver ? getFullAddress(order) : (order.address_line_1 || displayCity)}
              </span>
            </div>
          )}

          {/* Order Date - Admin only */}
          {!isDriver && orderDate && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                Order: {format(orderDate, 'MMM d, yyyy')}
              </span>
            </div>
          )}

          {/* Shipment ID - Admin only */}
          {!isDriver && (
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              {order.shipment_id ? (
                <span className="font-mono text-primary text-xs bg-primary/5 px-1.5 py-0.5 rounded">
                  {order.shipment_id}
                </span>
              ) : (
                <span className="text-muted-foreground/60 italic text-xs">
                  Not assigned
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Button (for driver) */}
        {actionButton && (
          <div className="mt-3 pl-[46px]">
            {actionButton}
          </div>
        )}

        {/* Bottom Row - Doctor & Arrow (Admin only) */}
        {!isDriver && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 pl-[46px]">
            <div className="flex-1 min-w-0">
              {order.authorizing_doctor_name && (
                <p className="text-xs text-muted-foreground truncate">
                  Dr. {order.authorizing_doctor_name}
                </p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />
          </div>
        )}
      </div>
    </Card>
  );
}
