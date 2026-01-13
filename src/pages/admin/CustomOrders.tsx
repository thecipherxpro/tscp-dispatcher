import { useState } from 'react';
import { Package, Search, Upload, CheckSquare, X, Trash2, FileDown, Loader2, ArrowRight } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useCustomOrders, CustomOrder } from '@/hooks/useCustomOrders';
import { CustomOrderImportModal } from '@/components/orders/CustomOrderImportModal';
import { CustomLabelGeneratorSheet } from '@/components/orders/CustomLabelGeneratorSheet';
import { CustomLabelGeneratorDialog } from '@/components/orders/CustomLabelGeneratorDialog';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useToast } from '@/hooks/use-toast';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const formatDate = (date: string | null): string => {
  if (!date) return 'N/A';
  // Parse as UTC to avoid timezone shifts for date-only values
  const d = new Date(date + 'T00:00:00Z');
  return d.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

export default function CustomOrders() {
  const { orders, isLoading, refetch, deleteOrders, moveToOrders } = useCustomOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showLabelGenerator, setShowLabelGenerator] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveConfirm, setShowMoveConfirm] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const haptic = useHapticFeedback();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleRefresh = async () => {
    await refetch();
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.client_name?.toLowerCase().includes(query) ||
      order.shipment_id?.toLowerCase().includes(query) ||
      order.address_line_1?.toLowerCase().includes(query) ||
      order.email?.toLowerCase().includes(query)
    );
  });

  const allSelected = filteredOrders.length > 0 && 
    filteredOrders.every(o => selectedOrderIds.has(o.id));

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

  const selectAll = () => {
    haptic.medium();
    setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
  };

  const clearSelection = () => {
    haptic.light();
    setSelectedOrderIds(new Set());
    setIsSelectionMode(false);
  };

  const getSelectedOrders = (): CustomOrder[] => {
    return orders.filter(o => selectedOrderIds.has(o.id));
  };

  const handleDelete = async () => {
    const idsToDelete = Array.from(selectedOrderIds);
    const success = await deleteOrders(idsToDelete);
    if (success) {
      clearSelection();
    }
    setShowDeleteConfirm(false);
  };

  const handleMoveToOrders = async () => {
    setIsMoving(true);
    const idsToMove = Array.from(selectedOrderIds);
    const success = await moveToOrders(idsToMove);
    if (success) {
      clearSelection();
    }
    setIsMoving(false);
    setShowMoveConfirm(false);
  };

  const OrderCardMobile = ({ order }: { order: CustomOrder }) => (
    <Card 
      className="bg-card border-border cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => {
        if (isSelectionMode) {
          toggleOrderSelection(order.id);
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {order.client_name || 'Unknown'}
            </p>
            <p className="text-xs text-muted-foreground">
              {order.shipment_id || 'No ID'}
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            Custom
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {order.address_line_1 || 'No address'}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
          {order.injection_qty && order.injection_qty > 0 && (
            <Badge variant="outline" className="text-xs">
              Inj: {order.injection_qty}
            </Badge>
          )}
          {order.nasal_qty && order.nasal_qty > 0 && (
            <Badge variant="outline" className="text-xs">
              Nasal: {order.nasal_qty}
            </Badge>
          )}
          {order.naloxone_kit_x4_qty && order.naloxone_kit_x4_qty > 0 && (
            <Badge variant="outline" className="text-xs">
              Kit X4: {order.naloxone_kit_x4_qty}
            </Badge>
          )}
          <span className="ml-auto">{formatDate(order.order_date)}</span>
        </div>
        {order.phone && (
          <p className="text-xs text-muted-foreground mt-1">
            📞 {order.phone}
          </p>
        )}
      </CardContent>
    </Card>
  );

  // Mobile View
  if (isMobile) {
    return (
      <AdminLayout title="Custom Orders" showBackButton>
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
                Import
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
                </div>
                <Button
                  variant={allSelected ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    if (allSelected) {
                      clearSelection();
                    } else {
                      selectAll();
                    }
                  }}
                  disabled={filteredOrders.length === 0}
                >
                  {allSelected ? 'Deselect' : 'Select All'}
                </Button>
                {selectedOrderIds.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        haptic.medium();
                        setShowMoveConfirm(true);
                      }}
                      disabled={isMoving}
                    >
                      {isMoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        haptic.medium();
                        setShowLabelGenerator(true);
                      }}
                    >
                      <FileDown className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search custom orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Orders List */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
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
                  <p className="text-foreground font-medium">No custom orders</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Import orders to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="relative">
                    {isSelectionMode && (
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
                    <div className={isSelectionMode ? 'pl-10' : ''}>
                      <OrderCardMobile order={order} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {orders.length > 0 && (
              <div className="text-center text-xs text-muted-foreground pt-2">
                Showing {filteredOrders.length} of {orders.length} orders
              </div>
            )}
          </div>
        </PullToRefresh>

        <CustomOrderImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            refetch();
          }}
        />

        <CustomLabelGeneratorSheet
          orders={getSelectedOrders()}
          isOpen={showLabelGenerator}
          onClose={() => setShowLabelGenerator(false)}
        />

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Orders</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedOrderIds.size} order(s)? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    );
  }

  // Desktop View
  return (
    <AdminLayout title="Custom Orders">
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
            <Badge variant="secondary">
              {orders.length} total
            </Badge>
          </div>
          <div className="flex gap-2">
            {selectedOrderIds.size > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedOrderIds.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowMoveConfirm(true)}
                  disabled={isMoving}
                >
                  {isMoving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  Move to Orders ({selectedOrderIds.size})
                </Button>
                <Button
                  onClick={() => setShowLabelGenerator(true)}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Generate Labels ({selectedOrderIds.size})
                </Button>
              </>
            )}
            <Button onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import Orders
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card className="bg-card border-border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected && filteredOrders.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAll();
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Shipment ID</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Medications</TableHead>
                  <TableHead>Order Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No custom orders found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedOrderIds.has(order.id)}
                          onCheckedChange={() => toggleOrderSelection(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.client_name || 'Unknown'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {order.shipment_id || 'N/A'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {order.address_line_1 || 'No address'}
                      </TableCell>
                      <TableCell>
                        {order.geo_zone ? (
                          <Badge variant="outline">{order.geo_zone}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {order.injection_qty && order.injection_qty > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Inj: {order.injection_qty}
                            </Badge>
                          )}
                          {order.nasal_qty && order.nasal_qty > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Nasal: {order.nasal_qty}
                            </Badge>
                          )}
                          {order.naloxone_kit_x4_qty && order.naloxone_kit_x4_qty > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Kit X4: {order.naloxone_kit_x4_qty}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(order.order_date)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {orders.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing {filteredOrders.length} of {orders.length} orders
          </div>
        )}
      </div>

      <CustomOrderImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          refetch();
        }}
      />

      <CustomLabelGeneratorDialog
        orders={getSelectedOrders()}
        isOpen={showLabelGenerator}
        onClose={() => setShowLabelGenerator(false)}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Orders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedOrderIds.size} order(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showMoveConfirm} onOpenChange={setShowMoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Orders</AlertDialogTitle>
            <AlertDialogDescription>
              Move {selectedOrderIds.size} order(s) to the Orders page for delivery? 
              This will generate tracking IDs and remove them from Custom Orders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMoveToOrders} disabled={isMoving}>
              {isMoving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Move to Orders
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
