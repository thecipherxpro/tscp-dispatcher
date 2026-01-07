import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, QrCode, X, Package, MapPin, ChevronRight, Camera, FileDown, Printer, User, Clock } from 'lucide-react';
import { BrowserQRCodeReader } from '@zxing/library';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { PackageLabel } from '@/components/orders/PackageLabel';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

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

const formatDateTime = (date: string | null) => {
  if (!date) return null;
  return new Date(date).toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function DriverScan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const haptic = useHapticFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showLabelSheet, setShowLabelSheet] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);

  // Fetch driver's assigned orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('assigned_driver_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setOrders(data as Order[] || []);
        setFilteredOrders(data as Order[] || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
        toast({
          title: 'Error',
          description: 'Failed to load orders',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, [user]);

  // Filter orders based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOrders(orders);
      return;
    }
    const query = searchQuery.toLowerCase().trim();
    const filtered = orders.filter(order => 
      order.tracking_id?.toLowerCase().includes(query) || 
      order.shipment_id?.toLowerCase().includes(query) || 
      order.name?.toLowerCase().includes(query) || 
      order.address_1?.toLowerCase().includes(query) || 
      order.city?.toLowerCase().includes(query) || 
      order.postal?.toLowerCase().includes(query)
    );
    setFilteredOrders(filtered);
  }, [searchQuery, orders]);

  // Stop scanning helper - defined first for use in other callbacks
  const stopScanning = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Parse QR code value - handles multiple formats
  const parseQRCodeValue = useCallback((qrValue: string): { trackingId?: string; shipmentId?: string; orderId?: string } => {
    const trimmedValue = qrValue.trim();
    
    // Try to parse as JSON (new QR code format)
    try {
      const parsed = JSON.parse(trimmedValue);
      return {
        trackingId: parsed.tracking_id || parsed.trackingId,
        shipmentId: parsed.shipment_id || parsed.shipmentId,
        orderId: parsed.order_id || parsed.orderId || parsed.id
      };
    } catch {
      // Not JSON, continue with other formats
    }
    
    // Check if it's a URL (tracking URL format)
    try {
      const url = new URL(trimmedValue);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const trackingParam = url.searchParams.get('tracking') || url.searchParams.get('id');
      
      // Handle /track/TRACKING_ID format
      if (pathParts.includes('track') && pathParts.length > 1) {
        const trackIndex = pathParts.indexOf('track');
        return { trackingId: pathParts[trackIndex + 1] };
      }
      
      // Handle query param format
      if (trackingParam) {
        return { trackingId: trackingParam };
      }
      
      // Use last path segment as tracking ID
      if (pathParts.length > 0) {
        return { trackingId: pathParts[pathParts.length - 1] };
      }
    } catch {
      // Not a URL, treat as plain ID
    }
    
    // Plain text - could be tracking ID or shipment ID
    return { trackingId: trimmedValue.toUpperCase() };
  }, []);

  // Find order by parsed QR data
  const findOrderByQRData = useCallback((qrData: { trackingId?: string; shipmentId?: string; orderId?: string }): Order | undefined => {
    return orders.find(order => {
      // Match by order ID (UUID)
      if (qrData.orderId && order.id === qrData.orderId) {
        return true;
      }
      
      // Match by tracking ID (case-insensitive)
      if (qrData.trackingId && order.tracking_id?.toUpperCase() === qrData.trackingId.toUpperCase()) {
        return true;
      }
      
      // Match by shipment ID (case-insensitive)
      if (qrData.shipmentId && order.shipment_id?.toUpperCase() === qrData.shipmentId.toUpperCase()) {
        return true;
      }
      
      // Also check if trackingId matches shipment_id (backwards compatibility)
      if (qrData.trackingId && order.shipment_id?.toUpperCase() === qrData.trackingId.toUpperCase()) {
        return true;
      }
      
      return false;
    });
  }, [orders]);

  // Handle QR code detection with auto-detection logic
  const handleQRCodeDetected = useCallback((qrValue: string) => {
    haptic.success();
    
    const qrData = parseQRCodeValue(qrValue);
    const foundOrder = findOrderByQRData(qrData);
    
    if (foundOrder) {
      setSelectedOrder(foundOrder);
      setShowOrderDetail(true);
      stopScanning();
      setSearchQuery('');
      toast({
        title: 'Order Found',
        description: `Found order for ${foundOrder.name || 'customer'}`
      });
    } else {
      haptic.error();
      const searchedId = qrData.trackingId || qrData.shipmentId || qrData.orderId || qrValue;
      toast({
        title: 'Order Not Found',
        description: `No order found with ID: ${searchedId}`,
        variant: 'destructive'
      });
    }
  }, [parseQRCodeValue, findOrderByQRData, haptic, stopScanning]);

  // Start QR code scanning
  const startScanning = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: 'Camera Not Supported',
        description: 'Your browser does not support camera access.',
        variant: 'destructive'
      });
      return;
    }

    setIsScanning(true);
    haptic.light();

    setTimeout(async () => {
      try {
        const codeReader = new BrowserQRCodeReader();
        codeReaderRef.current = codeReader;

        await codeReader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result, error) => {
            if (result) {
              handleQRCodeDetected(result.getText());
            }
            // Ignore NotFoundException - means no QR in frame yet
          }
        );

        toast({
          title: 'Camera Active',
          description: 'Point camera at QR code to scan'
        });
      } catch (error: any) {
        console.error('Camera access error:', error);
        setIsScanning(false);
        
        let errorMessage = 'Unable to access camera.';
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is in use by another app.';
        }
        
        haptic.error();
        toast({
          title: 'Camera Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }, 100);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  // Handle manual search
  const handleManualSearch = (value: string) => {
    const trimmedValue = value.trim().toUpperCase();
    if (!trimmedValue) return;
    
    const foundOrder = orders.find(order => 
      order.tracking_id?.toUpperCase() === trimmedValue || 
      order.shipment_id?.toUpperCase() === trimmedValue
    );
    
    if (foundOrder) {
      setSelectedOrder(foundOrder);
      setShowOrderDetail(true);
      stopScanning();
      setSearchQuery('');
    } else {
      toast({
        title: 'Order Not Found',
        description: `No order found with ID: ${trimmedValue}`,
        variant: 'destructive'
      });
    }
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  const handleViewLabel = () => {
    setShowLabelSheet(true);
  };

  const handleNavigateToDelivery = () => {
    if (selectedOrder) {
      setShowOrderDetail(false);
      navigate(`/driver-delivery/${selectedOrder.id}`);
    }
  };

  const fullAddress = selectedOrder 
    ? [selectedOrder.address_1, selectedOrder.address_2, selectedOrder.city, selectedOrder.province, selectedOrder.postal].filter(Boolean).join(', ') 
    : '';

  return (
    <AppLayout title="Scan" showUserMenu>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Search Bar */}
        <div className="p-4 bg-card border-b border-border sticky top-0 z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by tracking #, name, address..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleManualSearch(searchQuery);
                }
              }} 
              className="pl-10 pr-10 h-12 text-base bg-background" 
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scanner Sheet from Top */}
        <Sheet open={isScanning} onOpenChange={(open) => !open && stopScanning()}>
          <SheetContent side="top" className="h-[50vh] rounded-b-3xl p-0">
            <div className="relative h-full bg-black">
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
                playsInline 
                muted 
                autoPlay
              />
              
              {/* QR Code scanning overlay with corner brackets */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 relative">
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
              </div>
              
              {/* Header overlay */}
              <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <QrCode className="w-5 h-5" />
                    <span className="font-medium">Scan QR Code</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={stopScanning} className="text-white hover:bg-white/20">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Manual entry section */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-sm text-white/80 text-center mb-3">
                  Point camera at QR code or enter manually
                </p>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter tracking #..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualSearch(searchQuery);
                      }
                    }}
                    className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                  />
                  <Button 
                    variant="secondary" 
                    onClick={() => handleManualSearch(searchQuery)}
                  >
                    Search
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-1/3 mb-2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <Skeleton className="w-16 h-6 rounded-full" />
                  </div>
                </Card>
              ))}
            </>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">
                {searchQuery ? 'No matching orders' : 'No orders assigned'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try a different search term or scan a QR code' : 'Your assigned orders will appear here'}
              </p>
            </div>
          ) : (
            filteredOrders.map(order => {
              const statusConfig = getStatusConfig(order.timeline_status);
              const address = [order.city, order.province].filter(Boolean).join(', ');
              return (
                <Card 
                  key={order.id} 
                  className={cn(
                    "bg-card border-border overflow-hidden cursor-pointer",
                    "active:scale-[0.98] transition-all duration-150",
                    "hover:shadow-md hover:border-primary/30"
                  )} 
                  onClick={() => handleOrderClick(order)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate leading-tight">
                            {order.name || 'Unknown'}
                          </p>
                          {order.tracking_id && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {order.tracking_id}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(statusConfig.className, "text-xs font-medium flex-shrink-0")}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    
                    {address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground pl-[46px]">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{address}</span>
                        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Sticky Scan Button */}
        <div className="fixed bottom-16 left-0 right-0 px-0 pb-0 z-20 bg-gradient-to-t from-background via-background to-transparent pt-0">
          <Button size="lg" className="w-full h-14 text-base font-semibold gap-3 shadow-lg" onClick={startScanning}>
            <QrCode className="w-5 h-5" />
            Scan QR Code
          </Button>
        </div>
      </div>

      {/* Order Detail Sheet */}
      <Sheet open={showOrderDetail} onOpenChange={setShowOrderDetail}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <SheetHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">Order Details</SheetTitle>
              {selectedOrder && (
                <Badge variant="outline" className={getStatusConfig(selectedOrder.timeline_status).className}>
                  {getStatusConfig(selectedOrder.timeline_status).label}
                </Badge>
              )}
            </div>
          </SheetHeader>

          {selectedOrder && (
            <div className="overflow-y-auto h-[calc(100%-8rem)] py-4 space-y-4">
              {/* Shipment Info */}
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Shipment ID</p>
                    <p className="font-semibold text-foreground">{selectedOrder.shipment_id || 'N/A'}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleViewLabel} className="gap-1.5">
                    <FileDown className="w-4 h-4" />
                    Label
                  </Button>
                </div>
              </Card>

              {/* Customer Info */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <User className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Customer</p>
                    <p className="font-semibold text-foreground">{selectedOrder.name || 'Unknown'}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 pl-[52px]">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{fullAddress || 'No address'}</p>
                </div>
              </Card>

              {/* Timeline Info */}
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <p className="font-medium text-foreground">Timeline</p>
                </div>
                <div className="space-y-2 pl-8">
                  {selectedOrder.assigned_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Assigned</span>
                      <span className="text-foreground">{formatDateTime(selectedOrder.assigned_at)}</span>
                    </div>
                  )}
                  {selectedOrder.picked_up_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Picked Up</span>
                      <span className="text-foreground">{formatDateTime(selectedOrder.picked_up_at)}</span>
                    </div>
                  )}
                  {selectedOrder.in_route_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">In Route</span>
                      <span className="text-foreground">{formatDateTime(selectedOrder.in_route_at)}</span>
                    </div>
                  )}
                  {selectedOrder.arrived_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Arrived</span>
                      <span className="text-foreground">{formatDateTime(selectedOrder.arrived_at)}</span>
                    </div>
                  )}
                  {selectedOrder.completed_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="text-foreground">{formatDateTime(selectedOrder.completed_at)}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Action Button */}
              {selectedOrder.timeline_status !== 'COMPLETED_DELIVERED' && 
               selectedOrder.timeline_status !== 'COMPLETED_INCOMPLETE' && (
                <Button 
                  size="lg" 
                  className="w-full h-14 text-base font-semibold gap-2"
                  onClick={handleNavigateToDelivery}
                >
                  <MapPin className="w-5 h-5" />
                  Start Delivery
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Label Sheet */}
      <Sheet open={showLabelSheet} onOpenChange={setShowLabelSheet}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle>Package Label</SheetTitle>
          </SheetHeader>
          <div className="py-4 overflow-y-auto h-[calc(100%-4rem)]">
            {selectedOrder && <PackageLabel order={selectedOrder} />}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
