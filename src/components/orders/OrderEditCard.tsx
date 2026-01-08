import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, MapPin, Calendar, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Order {
  id: string;
  shipment_id: string | null;
  tracking_id: string | null;
  client_name: string | null;
  timeline_status: string | null;
  delivery_status: string | null;
  geo_zone: string | null;
  order_date: string | null;
  assigned_driver_id: string | null;
}

interface OrderEditCardProps {
  order: Order;
}

const getStatusColor = (status: string | null) => {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'PICKED_UP_AND_ASSIGNED':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'CONFIRMED':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'IN_ROUTE':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'ARRIVED':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'COMPLETED_DELIVERED':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'COMPLETED_INCOMPLETE':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusLabel = (status: string | null) => {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'PICKED_UP_AND_ASSIGNED':
      return 'Assigned';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'IN_ROUTE':
      return 'In Route';
    case 'ARRIVED':
      return 'Arrived';
    case 'COMPLETED_DELIVERED':
      return 'Delivered';
    case 'COMPLETED_INCOMPLETE':
      return 'Incomplete';
    case 'REVIEW_REQUESTED':
      return 'Review';
    default:
      return status || 'Unknown';
  }
};

export function OrderEditCard({ order }: OrderEditCardProps) {
  const navigate = useNavigate();

  const handleView = () => {
    const identifier = order.shipment_id || order.tracking_id || order.id;
    navigate(`/admin/order-edit?id=${identifier}`);
  };

  return (
    <Card className="hover:shadow-md transition-shadow h-full">
      <CardContent className="p-4">
        {/* Mobile Layout */}
        <div className="lg:hidden space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-semibold text-sm">
                {order.shipment_id || order.tracking_id || 'No ID'}
              </p>
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[150px]">{order.client_name || 'Unknown'}</span>
              </div>
            </div>
            <Badge className={`${getStatusColor(order.timeline_status)} text-xs shrink-0`}>
              {getStatusLabel(order.timeline_status)}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {order.geo_zone && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{order.geo_zone}</span>
                </div>
              )}
              {order.order_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(order.order_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleView}>
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        </div>

        {/* Desktop Layout - Consistent Card Structure */}
        <div className="hidden lg:flex lg:flex-col lg:h-full">
          {/* Top Row: ID and Status */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">
                {order.shipment_id || order.tracking_id || 'No ID'}
              </p>
              {order.tracking_id && order.shipment_id && (
                <p className="text-xs text-muted-foreground truncate">
                  {order.tracking_id}
                </p>
              )}
            </div>
            <Badge className={`${getStatusColor(order.timeline_status)} text-xs shrink-0`}>
              {getStatusLabel(order.timeline_status)}
            </Badge>
          </div>

          {/* Middle Row: Client Info */}
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate">{order.client_name || 'Unknown'}</span>
          </div>

          {/* Bottom Row: Meta + Action */}
          <div className="flex items-center justify-between gap-3 mt-auto pt-3 border-t">
            <div className="flex items-center gap-4 text-xs text-muted-foreground min-w-0">
              {order.geo_zone && (
                <div className="flex items-center gap-1 shrink-0">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{order.geo_zone}</span>
                </div>
              )}
              {order.order_date && (
                <div className="flex items-center gap-1 shrink-0">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{new Date(order.order_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleView} className="shrink-0">
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
