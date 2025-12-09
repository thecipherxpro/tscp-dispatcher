import { MapPin, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Order } from '@/types/auth';

interface DriverOrderCardProps {
  order: Order;
  onClick: () => void;
  actionButton?: React.ReactNode;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'PENDING':
      return { 
        label: 'Pending', 
        className: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      };
    case 'PICKED_UP_AND_ASSIGNED':
      return { 
        label: 'Assigned', 
        className: 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400'
      };
    case 'REVIEW_REQUESTED':
      return { 
        label: 'Review', 
        className: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      };
    case 'CONFIRMED':
      return { 
        label: 'Confirmed', 
        className: 'border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
      };
    case 'IN_ROUTE':
      return { 
        label: 'In Route', 
        className: 'border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-400'
      };
    case 'COMPLETED_DELIVERED':
      return { 
        label: 'Delivered', 
        className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      };
    case 'COMPLETED_INCOMPLETE':
      return { 
        label: 'Incomplete', 
        className: 'border-destructive/50 bg-destructive/10 text-destructive'
      };
    default:
      return { 
        label: status || 'Unknown', 
        className: 'border-muted-foreground/30 bg-muted text-muted-foreground'
      };
  }
};

export function DriverOrderCard({ order, onClick, actionButton }: DriverOrderCardProps) {
  const statusConfig = getStatusConfig(order.timeline_status);
  
  // Build full address - only show name and address for drivers
  const fullAddress = [
    order.address_1,
    order.address_2,
    order.city,
    order.province,
    order.postal
  ].filter(Boolean).join(', ');

  return (
    <Card 
      className="bg-card border-border overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-150 hover:shadow-md hover:border-primary/30"
      onClick={onClick}
    >
      <div className="p-4">
        {/* Header - Name and Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <p className="font-semibold text-foreground truncate leading-tight">
              {order.name || 'Unknown Client'}
            </p>
          </div>
          <Badge variant="outline" className={`${statusConfig.className} text-xs font-medium flex-shrink-0`}>
            {statusConfig.label}
          </Badge>
        </div>

        {/* Address Only */}
        {fullAddress && (
          <div className="flex items-start gap-2 text-sm pl-[46px]">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{fullAddress}</span>
          </div>
        )}

        {/* Action Button */}
        {actionButton && (
          <div className="mt-3 pl-[46px]">
            {actionButton}
          </div>
        )}
      </div>
    </Card>
  );
}
