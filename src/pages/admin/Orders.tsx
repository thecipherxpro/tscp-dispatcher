import { useState } from 'react';
import { Package, Search, Upload, CheckSquare, Square, X, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useOrders } from '@/hooks/useOrders';
import { OrderImportModal } from '@/components/orders/OrderImportModal';
import { OrderDetailSheet } from '@/components/orders/OrderDetailSheet';
import { OrderCard } from '@/components/orders/OrderCard';
import { BulkAssignmentModal } from '@/components/orders/BulkAssignmentModal';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Order } from '@/types/auth';

type FilterType = 'all' | 'pending' | 'assigned' | 'confirmed' | 'in_route' | 'arrived' | 'delivered' | 'incomplete' | 'review';

export default function Orders() {
  const { orders, isLoading, refetch } = useOrders(true); // Enable realtime
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
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
        assigned: 'PICKED_UP_AND_ASSIGNED',
        confirmed: 'CONFIRMED',
        in_route: 'IN_ROUTE',
        arrived: 'ARRIVED',
        delivered: 'COMPLETED_DELIVERED',
        incomplete: 'COMPLETED_INCOMPLETE',
        review: 'REVIEW_REQUESTED',
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
  const pendingOrders = filteredOrders.filter(o => o.timeline_status === 'PENDING');

  const toggleOrderSelection = (orderId: string) => {
    haptic.light();
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  const selectAllPending = () => {
    haptic.medium();
    const pendingIds = pendingOrders.map(o => o.id);
    setSelectedOrderIds(new Set(pendingIds));
  };

  const clearSelection = () => {
    haptic.light();
    setSelectedOrderIds(new Set());
    setIsSelectionMode(false);
  };

  const getSelectedOrders = () => {
    return orders.filter(o => selectedOrderIds.has(o.id));
  };

  const handleBulkAssignSuccess = () => {
    setShowBulkAssignModal(false);
    clearSelection();
    refetch();
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'in_route', label: 'In Route' },
    { key: 'arrived', label: 'Arrived' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'incomplete', label: 'Incomplete' },
    { key: 'review', label: 'Review' },
  ];

  return (
    <AppLayout title="Orders" showBackButton>
      <PullToRefresh onRefresh={handleRefresh} className="h-[calc(100vh-8rem)]">
        <div className="p-4 space-y-4">
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                haptic.light();
                setShowImportModal(true);
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Orders
            </Button>
            <Button
              variant={isSelectionMode ? "secondary" : "outline"}
              onClick={() => {
                haptic.light();
                if (isSelectionMode) {
                  clearSelection();
                } else {
                  setIsSelectionMode(true);
                }
              }}
            >
              {isSelectionMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
            </Button>
          </div>

          {/* Selection Mode Actions */}
          {isSelectionMode && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {selectedOrderIds.size} selected
                </p>
                <p className="text-xs text-muted-foreground">
                  Select pending orders to bulk assign
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllPending}
                disabled={pendingOrders.length === 0}
              >
                Select All Pending
              </Button>
              {selectedOrderIds.size > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    haptic.medium();
                    setShowBulkAssignModal(true);
                  }}
                >
                  <Users className="w-4 h-4 mr-1" />
                  Assign
                </Button>
              )}
            </div>
          )}

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
              <div key={order.id} className="relative">
                {isSelectionMode && order.timeline_status === 'PENDING' && (
                  <div 
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOrderSelection(order.id);
                    }}
                  >
                    <Checkbox
                      checked={selectedOrderIds.has(order.id)}
                      className="h-5 w-5"
                    />
                  </div>
                )}
                <div className={isSelectionMode && order.timeline_status === 'PENDING' ? 'pl-10' : ''}>
                  <OrderCard
                    order={order}
                    onClick={() => {
                      if (isSelectionMode && order.timeline_status === 'PENDING') {
                        toggleOrderSelection(order.id);
                      } else {
                        setSelectedOrder(order);
                      }
                    }}
                  />
                </div>
              </div>
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

      <OrderDetailSheet
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdate={refetch}
        isAdmin={true}
      />

      <BulkAssignmentModal
        orders={getSelectedOrders()}
        isOpen={showBulkAssignModal}
        onClose={() => setShowBulkAssignModal(false)}
        onSuccess={handleBulkAssignSuccess}
      />
    </AppLayout>
  );
}
