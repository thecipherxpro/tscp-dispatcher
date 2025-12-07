import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Package } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { format } from 'date-fns';

export default function TrackingList() {
  const navigate = useNavigate();
  const { orders, isLoading } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');

  // Only show orders that have been assigned (have tracking)
  const assignedOrders = orders.filter(order => order.assigned_driver_id);

  const filteredOrders = assignedOrders.filter(order => {
    const query = searchQuery.toLowerCase();
    return (
      order.name?.toLowerCase().includes(query) ||
      order.tracking_id?.toLowerCase().includes(query) ||
      order.shipment_id?.toLowerCase().includes(query) ||
      order.city?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-muted text-muted-foreground';
      case 'CONFIRMED': return 'bg-blue-500/10 text-blue-500';
      case 'IN_ROUTE': return 'bg-orange-500/10 text-orange-500';
      case 'ARRIVED': return 'bg-purple-500/10 text-purple-500';
      case 'COMPLETED': return 'bg-green-500/10 text-green-500';
      case 'REQUEST_ADDRESS_REVIEW': return 'bg-red-500/10 text-red-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AppLayout title="Track Shipments" showBackButton={false}>
      <div className="p-4 space-y-4 pb-24">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, tracking ID, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No assigned orders to track</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <Card
                key={order.id}
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/admin/tracking/${order.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{order.name || 'Unknown'}</span>
                      <Badge className={getStatusColor(order.timeline_status)}>
                        {order.timeline_status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    
                    {order.tracking_id && (
                      <p className="text-sm text-muted-foreground font-mono">
                        {order.tracking_id}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">
                        {[order.city, order.province].filter(Boolean).join(', ') || 'No address'}
                      </span>
                    </div>
                    
                    {order.confirmed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Assigned: {format(new Date(order.confirmed_at), 'MMM d, h:mm a')}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}