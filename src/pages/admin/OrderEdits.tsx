import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileNav } from '@/components/layout/MobileNav';
import { DesktopNav } from '@/components/layout/DesktopNav';
import { OrderEditCard } from '@/components/orders/OrderEditCard';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useOrders } from '@/hooks/useOrders';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, ArrowLeft, Filter } from 'lucide-react';

type FilterType = 'all' | 'pending' | 'assigned' | 'shipped' | 'delivered' | 'incomplete';

const filterOptions: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'incomplete', label: 'Incomplete' },
];

export default function OrderEdits() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { orders, isLoading, refetch } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter((order) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        order.shipment_id?.toLowerCase().includes(searchLower) ||
        order.tracking_id?.toLowerCase().includes(searchLower) ||
        order.client_name?.toLowerCase().includes(searchLower) ||
        order.geo_zone?.toLowerCase().includes(searchLower);

      // Status filter
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {/* Desktop: Off-canvas menu */}
            <div className="hidden lg:block">
              <DesktopNav title="Order Edits" />
            </div>
            {/* Mobile: Back button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg">Order Edits</h1>
          </div>
          <Badge variant="secondary" className="text-xs">
            {filteredOrders.length} orders
          </Badge>
        </div>

        {/* Search and Filters - Sticky */}
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
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Filter className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No orders found</p>
                <p className="text-sm text-muted-foreground/70">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <div className="space-y-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:space-y-0">
                {filteredOrders.map((order) => (
                  <OrderEditCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </div>
        </PullToRefresh>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
