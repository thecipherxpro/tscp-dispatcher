import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { OrderEditCard } from '@/components/orders/OrderEditCard';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useOrders } from '@/hooks/useOrders';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, Filter, Edit3 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type FilterType = 'all' | 'pending' | 'assigned' | 'shipped' | 'delivered' | 'incomplete';

const filterOptions: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'incomplete', label: 'Incomplete' },
];

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  PICKED_UP_AND_ASSIGNED: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  REVIEW_REQUESTED: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  CONFIRMED: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  IN_ROUTE: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  COMPLETED_DELIVERED: 'bg-green-500/10 text-green-600 border-green-500/20',
  COMPLETED_INCOMPLETE: 'bg-destructive/10 text-destructive border-destructive/20',
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

export default function OrderEdits() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { orders, isLoading, refetch } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter((order) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        order.shipment_id?.toLowerCase().includes(searchLower) ||
        order.tracking_id?.toLowerCase().includes(searchLower) ||
        order.client_name?.toLowerCase().includes(searchLower) ||
        order.geo_zone?.toLowerCase().includes(searchLower);

      let matchesStatus = true;
      switch (activeFilter) {
        case 'pending':
          matchesStatus = order.timeline_status === 'PENDING';
          break;
        case 'assigned':
          matchesStatus = order.timeline_status === 'PICKED_UP_AND_ASSIGNED' || 
                          order.timeline_status === 'CONFIRMED';
          break;
        case 'shipped':
          matchesStatus = order.timeline_status === 'IN_ROUTE';
          break;
        case 'delivered':
          matchesStatus = order.timeline_status === 'COMPLETED_DELIVERED';
          break;
        case 'incomplete':
          matchesStatus = order.timeline_status === 'COMPLETED_INCOMPLETE' ||
                          order.timeline_status === 'REVIEW_REQUESTED';
          break;
        default:
          matchesStatus = true;
      }

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, activeFilter]);

  const handleRefresh = async () => {
    await refetch();
  };

  // Mobile View
  if (isMobile) {
    return (
      <AdminLayout title="Order Edits" showBackButton>
        <div className="px-4 py-3 space-y-3 bg-background">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, name, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={activeFilter === option.value ? 'default' : 'outline'}
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => setActiveFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <PullToRefresh onRefresh={handleRefresh}>
          <div className="p-4 pb-24">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Filter className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No orders found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <OrderEditCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </div>
        </PullToRefresh>
      </AdminLayout>
    );
  }

  // Desktop View
  return (
    <AdminLayout title="Order Edits">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Order Edits</h2>
            <p className="text-muted-foreground">{filteredOrders.length} orders</p>
          </div>
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, name, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              variant={activeFilter === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Table */}
        <Card className="border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="mt-2 text-muted-foreground">Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <Filter className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">No orders found</p>
                <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Shipment ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden xl:table-cell">Address</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {order.shipment_id || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.client_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{order.email || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {order.address_line_1 || '-'}
                        </p>
                      </TableCell>
                      <TableCell>
                        {order.geo_zone ? (
                          <Badge variant="outline">{order.geo_zone}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={statusColors[order.timeline_status || 'PENDING']}
                        >
                          {statusLabels[order.timeline_status || 'PENDING']}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/admin/orders/${order.id}/edit`)}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Edit
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
