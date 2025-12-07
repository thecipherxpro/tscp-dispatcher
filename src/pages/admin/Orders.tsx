import { useState } from 'react';
import { Package, Search, Upload } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useOrders } from '@/hooks/useOrders';
import { OrderImportModal } from '@/components/orders/OrderImportModal';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { OrderCard } from '@/components/orders/OrderCard';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Order } from '@/types/auth';

type FilterType = 'all' | 'pending' | 'confirmed' | 'in_route' | 'completed' | 'address_review';

export default function Orders() {
  const { orders, isLoading, refetch } = useOrders(true); // Enable realtime
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const haptic = useHapticFeedback();

  const handleRefresh = async () => {
    await refetch();
  };

  const filterOrders = (orders: Order[]) => {
    let filtered = orders;

    // Apply status filter
    if (activeFilter !== 'all') {
      const statusMap: Record<FilterType, string> = {
        all: '',
        pending: 'PENDING',
        confirmed: 'CONFIRMED',
        in_route: 'IN_ROUTE',
        completed: 'COMPLETED',
        address_review: 'REQUEST_ADDRESS_REVIEW',
      };
      filtered = filtered.filter(o => o.timeline_status === statusMap[activeFilter]);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.name?.toLowerCase().includes(query) ||
        order.shipment_id?.toLowerCase().includes(query) ||
        order.city?.toLowerCase().includes(query) ||
        order.phone_number?.includes(query)
      );
    }

    return filtered;
  };

  const filteredOrders = filterOrders(orders);


  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'in_route', label: 'In Route' },
    { key: 'completed', label: 'Completed' },
    { key: 'address_review', label: 'Review' },
  ];

  return (
    <AppLayout title="Orders" showBackButton>
      <PullToRefresh onRefresh={handleRefresh} className="h-[calc(100vh-8rem)]">
        <div className="p-4 space-y-4">
          {/* Actions */}
          <Button
            className="w-full"
            onClick={() => {
              haptic.light();
              setShowImportModal(true);
            }}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Orders
          </Button>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filters with live indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">Live updates</span>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {filters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => {
                  haptic.light();
                  setActiveFilter(filter.key);
                }}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                  activeFilter === filter.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-foreground hover:bg-muted'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-lg p-4 border border-border animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-foreground font-medium">No orders found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {orders.length === 0 ? 'Import orders to get started' : 'Try a different filter'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => setSelectedOrder(order)}
              />
            ))}
          </div>
        )}

          {/* Stats */}
          {orders.length > 0 && (
            <div className="text-center text-xs text-muted-foreground pt-2">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* Modals */}
      <OrderImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          refetch();
        }}
      />

      <OrderDetailModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdate={refetch}
        isAdmin={true}
      />
    </AppLayout>
  );
}
