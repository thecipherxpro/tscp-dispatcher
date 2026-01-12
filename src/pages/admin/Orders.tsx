import { useState } from 'react';
import { Package, Search, Upload, CheckSquare, X, Users, MapPin, Loader2, Filter } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useOrders } from '@/hooks/useOrders';
import { TemplateOrderImportModal } from '@/components/orders/TemplateOrderImportModal';
import { OrderDetailSheet } from '@/components/orders/OrderDetailSheet';
import { OrderDetailDialog } from '@/components/orders/OrderDetailDialog';
import { OrderCard } from '@/components/orders/OrderCard';
import { BulkAssignmentModal } from '@/components/orders/BulkAssignmentModal';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Order } from '@/types/auth';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type FilterType = 'all' | 'pending' | 'assigned' | 'confirmed' | 'in_route' | 'delivered' | 'incomplete' | 'review' | 'no_geo';

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  PICKED_UP_AND_ASSIGNED: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  REVIEW_REQUESTED: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  CONFIRMED: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  IN_ROUTE: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  ARRIVED: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  COMPLETED_DELIVERED: 'bg-green-500/10 text-green-600 border-green-500/20',
  COMPLETED_INCOMPLETE: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  PICKED_UP_AND_ASSIGNED: 'Assigned',
  REVIEW_REQUESTED: 'Review',
  CONFIRMED: 'Confirmed',
  IN_ROUTE: 'In Route',
  ARRIVED: 'Arrived',
  COMPLETED_DELIVERED: 'Delivered',
  COMPLETED_INCOMPLETE: 'Incomplete',
};

export default function Orders() {
  const { orders, isLoading, refetch } = useOrders(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [isRegeocoding, setIsRegeocoding] = useState(false);
  const haptic = useHapticFeedback();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleRefresh = async () => {
    await refetch();
  };

  const filterOrders = (orders: Order[]) => {
    let filtered = orders;

    if (activeFilter === 'no_geo') {
      filtered = filtered.filter(o => !o.latitude || !o.longitude || !o.geo_zone);
    } else if (activeFilter !== 'all') {
      const statusMap: Record<Exclude<FilterType, 'all' | 'no_geo'>, string> = {
        pending: 'PENDING',
        assigned: 'PICKED_UP_AND_ASSIGNED',
        confirmed: 'CONFIRMED',
        in_route: 'IN_ROUTE',
        delivered: 'COMPLETED_DELIVERED',
        incomplete: 'COMPLETED_INCOMPLETE',
        review: 'REVIEW_REQUESTED',
      };
      filtered = filtered.filter(o => o.timeline_status === statusMap[activeFilter as keyof typeof statusMap]);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.client_name?.toLowerCase().includes(query) ||
        order.shipment_id?.toLowerCase().includes(query) ||
        order.address_line_1?.toLowerCase().includes(query) ||
        order.email?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredOrders = filterOrders(orders);
  const filteredPendingOrders = filteredOrders.filter(o => o.timeline_status === 'PENDING');
  const allFilteredSelected = filteredPendingOrders.length > 0 && 
    filteredPendingOrders.every(o => selectedOrderIds.has(o.id));

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

  const selectAllFiltered = () => {
    haptic.medium();
    const filteredPendingIds = filteredOrders
      .filter(o => o.timeline_status === 'PENDING')
      .map(o => o.id);
    setSelectedOrderIds(new Set(filteredPendingIds));
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

  const handleRegeocode = async () => {
    const ordersNeedingGeo = orders.filter(o => 
      o.address_line_1 && (!o.latitude || !o.longitude || !o.geo_zone)
    );

    if (ordersNeedingGeo.length === 0) {
      toast({
        title: "No orders to geocode",
        description: "All orders with addresses already have coordinates.",
      });
      return;
    }

    setIsRegeocoding(true);
    haptic.medium();
    
    let successCount = 0;
    let failCount = 0;

    for (const order of ordersNeedingGeo) {
      try {
        const address = `${order.address_line_1}, Canada`;
        const { data, error } = await supabase.functions.invoke('geocode-address', {
          body: { address }
        });

        if (error || !data) {
          failCount++;
          continue;
        }

        await supabase
          .from('orders')
          .update({
            latitude: data.latitude,
            longitude: data.longitude,
            geo_zone: data.geo_zone,
            country: data.country || 'Canada'
          })
          .eq('id', order.id);

        successCount++;
      } catch (err) {
        console.error('Geocode error for order:', order.id, err);
        failCount++;
      }
    }

    setIsRegeocoding(false);
    
    toast({
      title: "Geocoding Complete",
      description: `${successCount} orders geocoded successfully.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
    });

    refetch();
  };

  const ordersNeedingGeo = orders.filter(o => !o.latitude || !o.longitude || !o.geo_zone);

  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'pending', label: 'Pending', count: orders.filter(o => o.timeline_status === 'PENDING').length },
    { key: 'assigned', label: 'Assigned', count: orders.filter(o => o.timeline_status === 'PICKED_UP_AND_ASSIGNED').length },
    { key: 'confirmed', label: 'Confirmed', count: orders.filter(o => o.timeline_status === 'CONFIRMED').length },
    { key: 'in_route', label: 'In Route', count: orders.filter(o => o.timeline_status === 'IN_ROUTE').length },
    { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.timeline_status === 'COMPLETED_DELIVERED').length },
    { key: 'incomplete', label: 'Incomplete', count: orders.filter(o => o.timeline_status === 'COMPLETED_INCOMPLETE').length },
    { key: 'review', label: 'Review', count: orders.filter(o => o.timeline_status === 'REVIEW_REQUESTED').length },
    { key: 'no_geo', label: 'No Location', count: ordersNeedingGeo.length },
  ];

  // Mobile View
  if (isMobile) {
    return (
      <AdminLayout title="Orders" showBackButton>
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
              {ordersNeedingGeo.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleRegeocode}
                  disabled={isRegeocoding}
                >
                  {isRegeocoding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                </Button>
              )}
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
                  variant={allFilteredSelected ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    if (allFilteredSelected) {
                      clearSelection();
                    } else {
                      selectAllFiltered();
                    }
                  }}
                  disabled={filteredPendingOrders.length === 0}
                >
                  {allFilteredSelected ? 'Deselect All' : `Select All (${filteredPendingOrders.length})`}
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
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

        <TemplateOrderImportModal
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
      </AdminLayout>
    );
  }

  // Desktop View
  return (
    <AdminLayout title="Orders">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, shipment ID, address, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-muted-foreground">Live updates</span>
            </div>
          </div>
          <div className="flex gap-2">
            {ordersNeedingGeo.length > 0 && (
              <Button
                variant="outline"
                onClick={handleRegeocode}
                disabled={isRegeocoding}
              >
                {isRegeocoding ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4 mr-2" />
                )}
                Geocode ({ordersNeedingGeo.length})
              </Button>
            )}
            <Button
              variant={isSelectionMode ? "secondary" : "outline"}
              onClick={() => {
                if (isSelectionMode) {
                  clearSelection();
                } else {
                  setIsSelectionMode(true);
                }
              }}
            >
              {isSelectionMode ? <X className="w-4 h-4 mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}
              {isSelectionMode ? 'Cancel' : 'Select'}
            </Button>
            <Button onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import Orders
            </Button>
          </div>
        </div>

        {/* Selection Bar */}
        {isSelectionMode && (
          <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {selectedOrderIds.size} orders selected
              </p>
              <p className="text-sm text-muted-foreground">
                Select pending orders to bulk assign to a driver
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                if (allFilteredSelected) {
                  clearSelection();
                } else {
                  selectAllFiltered();
                }
              }}
              disabled={filteredPendingOrders.length === 0}
            >
              {allFilteredSelected ? 'Deselect All' : `Select All Pending (${filteredPendingOrders.length})`}
            </Button>
            {selectedOrderIds.size > 0 && (
              <Button onClick={() => setShowBulkAssignModal(true)}>
                <Users className="w-4 h-4 mr-2" />
                Bulk Assign
              </Button>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeFilter === filter.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-foreground hover:bg-muted'
              }`}
            >
              {filter.label}
              {filter.count !== undefined && filter.count > 0 && (
                <Badge variant="secondary" className={`text-xs ${activeFilter === filter.key ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}>
                  {filter.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <Card className="border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">No orders found</p>
                <p className="text-muted-foreground mt-1">
                  {orders.length === 0 ? 'Import orders to get started' : 'Try a different filter or search term'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {isSelectionMode && <TableHead className="w-12"></TableHead>}
                    <TableHead className="w-40">Shipment ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden xl:table-cell">Address</TableHead>
                    <TableHead className="hidden lg:table-cell">Zone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Order Date</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        if (isSelectionMode && order.timeline_status === 'PENDING') {
                          toggleOrderSelection(order.id);
                        } else {
                          setSelectedOrder(order);
                        }
                      }}
                    >
                      {isSelectionMode && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {order.timeline_status === 'PENDING' && (
                            <Checkbox
                              checked={selectedOrderIds.has(order.id)}
                              onCheckedChange={() => toggleOrderSelection(order.id)}
                            />
                          )}
                        </TableCell>
                      )}
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
                      <TableCell className="hidden lg:table-cell">
                        {order.geo_zone ? (
                          <Badge variant="outline" className="text-xs">
                            {order.geo_zone}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
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
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {order.order_date ? new Date(order.order_date + 'T00:00:00Z').toLocaleDateString('en-CA', { timeZone: 'UTC' }) : '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Footer Stats */}
        {orders.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing {filteredOrders.length} of {orders.length} orders
          </div>
        )}
      </div>

      <TemplateOrderImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          refetch();
        }}
      />

      {/* Use Dialog for desktop, Sheet for mobile */}
      {isMobile ? (
        <OrderDetailSheet
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={refetch}
          isAdmin={true}
        />
      ) : (
        <OrderDetailDialog
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={refetch}
          isAdmin={true}
        />
      )}

      <BulkAssignmentModal
        orders={getSelectedOrders()}
        isOpen={showBulkAssignModal}
        onClose={() => setShowBulkAssignModal(false)}
        onSuccess={handleBulkAssignSuccess}
      />
    </AdminLayout>
  );
}
