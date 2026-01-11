import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Package, Eye } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusColors: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  PICKED_UP_AND_ASSIGNED: 'bg-blue-500/10 text-blue-500',
  REVIEW_REQUESTED: 'bg-amber-500/10 text-amber-500',
  CONFIRMED: 'bg-indigo-500/10 text-indigo-500',
  IN_ROUTE: 'bg-purple-500/10 text-purple-500',
  COMPLETED_DELIVERED: 'bg-green-500/10 text-green-500',
  COMPLETED_INCOMPLETE: 'bg-red-500/10 text-red-500',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  PICKED_UP_AND_ASSIGNED: 'Assigned',
  REVIEW_REQUESTED: 'Review',
  CONFIRMED: 'Confirmed',
  IN_ROUTE: 'In Route',
  COMPLETED_DELIVERED: 'Delivered',
  COMPLETED_INCOMPLETE: 'Incomplete',
};

export default function TrackingList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { orders, isLoading } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');

  // Only show orders that have been assigned (have tracking)
  const assignedOrders = orders.filter(order => order.assigned_driver_id);

  const filteredOrders = assignedOrders.filter(order => {
    const query = searchQuery.toLowerCase();
    return (
      order.client_name?.toLowerCase().includes(query) ||
      order.tracking_id?.toLowerCase().includes(query) ||
      order.shipment_id?.toLowerCase().includes(query) ||
      order.geo_zone?.toLowerCase().includes(query)
    );
  });

  // Mobile View
  if (isMobile) {
    return (
      <AdminLayout title="Track Shipments" showBackButton>
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
                  onClick={() => navigate(`/tracking/${order.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{order.client_name || 'Unknown'}</span>
                        <Badge className={statusColors[order.timeline_status]}>
                          {statusLabels[order.timeline_status] || order.timeline_status.replace(/_/g, ' ')}
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
                          {order.geo_zone || order.address_line_1 || 'No address'}
                        </span>
                      </div>
                      
                      {order.picked_up_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Assigned: {format(new Date(order.picked_up_at), 'MMM d, h:mm a')}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </AdminLayout>
    );
  }

  // Desktop View
  return (
    <AdminLayout title="Track Shipments">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Track Shipments</h2>
            <p className="text-muted-foreground">{assignedOrders.length} shipments in progress</p>
          </div>
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, tracking ID, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Table */}
        <Card className="border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="mt-2 text-muted-foreground">Loading shipments...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">No shipments to track</p>
                <p className="text-muted-foreground mt-1">Assigned orders will appear here</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Tracking ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden xl:table-cell">Assigned</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {order.tracking_id || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.client_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{order.shipment_id || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.geo_zone ? (
                          <Badge variant="outline">{order.geo_zone}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.timeline_status]}>
                          {statusLabels[order.timeline_status] || order.timeline_status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                        {order.picked_up_at ? format(new Date(order.picked_up_at), 'MMM d, h:mm a') : '-'}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/tracking/${order.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Track
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
