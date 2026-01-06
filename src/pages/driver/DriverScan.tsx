import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ScanBarcode, X, Package, MapPin, ChevronRight, Camera, FileDown, Printer, User, Clock } from 'lucide-react';
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
  const {
    user
  } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showLabelSheet, setShowLabelSheet] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch driver's assigned orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      try {
        const {
          data,
          error
        } = await supabase.from('orders').select('*').eq('assigned_driver_id', user.id).order('created_at', {
          ascending: false
        });
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
    const filtered = orders.filter(order => order.tracking_id?.toLowerCase().includes(query) || order.shipment_id?.toLowerCase().includes(query) || order.name?.toLowerCase().includes(query) || order.address_1?.toLowerCase().includes(query) || order.city?.toLowerCase().includes(query) || order.postal?.toLowerCase().includes(query));
    setFilteredOrders(filtered);
  }, [searchQuery, orders]);

  // Handle barcode scanning via camera
  const startScanning = async () => {
    setIsScanning(true);
    
    // Small delay to ensure video element is rendered
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for video metadata to load before playing
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.error);
          };
        }

        toast({
          title: 'Camera Active',
          description: 'Point camera at barcode or enter tracking number manually'
        });
      } catch (error) {
        console.error('Camera access error:', error);
        setIsScanning(false);
        toast({
          title: 'Camera Error',
          description: 'Unable to access camera. Please check permissions.',
          variant: 'destructive'
        });
      }
    }, 100);
  };
  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  // Handle scanned/searched barcode
  const handleBarcodeSearch = (barcode: string) => {
    const trimmedBarcode = barcode.trim().toUpperCase();
    if (!trimmedBarcode) return;
    const foundOrder = orders.find(order => order.tracking_id?.toUpperCase() === trimmedBarcode || order.shipment_id?.toUpperCase() === trimmedBarcode);
    if (foundOrder) {
      setSelectedOrder(foundOrder);
      setShowOrderDetail(true);
      stopScanning();
      setSearchQuery('');
    } else {
      toast({
        title: 'Order Not Found',
        description: `No order found with ID: ${trimmedBarcode}`,
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
  const fullAddress = selectedOrder ? [selectedOrder.address_1, selectedOrder.address_2, selectedOrder.city, selectedOrder.province, selectedOrder.postal].filter(Boolean).join(', ') : '';
  return <AppLayout title="Scan" showUserMenu>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Search Bar */}
        <div className="p-4 bg-card border-b border-border sticky top-0 z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by tracking #, name, address..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => {
            if (e.key === 'Enter') {
              handleBarcodeSearch(searchQuery);
            }
          }} className="pl-10 pr-10 h-12 text-base bg-background" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>}
          </div>
        </div>

        {/* Scanner View */}
        {isScanning && <div className="relative bg-black">
            <video 
              ref={videoRef} 
              className="w-full h-64 object-cover" 
              playsInline 
              muted 
              autoPlay
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-32 border-2 border-primary rounded-lg relative">
                <div className="absolute -top-1 left-4 right-4 h-0.5 bg-primary animate-pulse" />
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={stopScanning} className="absolute top-2 right-2">
              <X className="w-4 h-4 mr-1" />
              Close
            </Button>
          </div>}

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
          {isLoading ? <>
              {[1, 2, 3, 4].map(i => <Card key={i} className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-1/3 mb-2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <Skeleton className="w-16 h-6 rounded-full" />
                  </div>
                </Card>)}
            </> : filteredOrders.length === 0 ? <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">
                {searchQuery ? 'No matching orders' : 'No orders assigned'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try a different search term or scan a barcode' : 'Your assigned orders will appear here'}
              </p>
            </div> : filteredOrders.map(order => {
          const statusConfig = getStatusConfig(order.timeline_status);
          const address = [order.city, order.province].filter(Boolean).join(', ');
          return <Card key={order.id} className={cn("bg-card border-border overflow-hidden cursor-pointer", "active:scale-[0.98] transition-all duration-150", "hover:shadow-md hover:border-primary/30")} onClick={() => handleOrderClick(order)}>
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
                          {order.tracking_id && <p className="text-xs text-muted-foreground font-mono">
                              {order.tracking_id}
                            </p>}
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(statusConfig.className, "text-xs font-medium flex-shrink-0")}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    
                    {address && <div className="flex items-center gap-2 text-sm text-muted-foreground pl-[46px]">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{address}</span>
                        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/50" />
                      </div>}
                  </div>
                </Card>;
        })}
        </div>

        {/* Sticky Scan Button - attached to bottom nav */}
        <div className="fixed bottom-16 left-0 right-0 px-0 pb-0 z-20 bg-gradient-to-t from-background via-background to-transparent pt-0">
          <Button size="lg" className="w-full h-14 text-base font-semibold gap-3 shadow-lg" onClick={startScanning}>
            <ScanBarcode className="w-5 h-5" />
            Scan Package Barcode
          </Button>
        </div>
      </div>

      {/* Order Detail Sheet */}
      <Sheet open={showOrderDetail} onOpenChange={setShowOrderDetail}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <SheetHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">Order Details</SheetTitle>
              {selectedOrder && <Badge variant="outline" className={getStatusConfig(selectedOrder.timeline_status).className}>
                  {getStatusConfig(selectedOrder.timeline_status).label}
                </Badge>}
            </div>
          </SheetHeader>

          {selectedOrder && <div className="overflow-y-auto h-[calc(100%-8rem)] py-4 space-y-4">
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
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Tracking #</p>
                    <p className="text-sm font-mono text-foreground">{selectedOrder.tracking_id || 'N/A'}</p>
                  </div>
                </div>
              </Card>

              {/* Customer Info */}
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-sm font-bold text-muted-foreground">
                        {selectedOrder.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{selectedOrder.name || 'Customer'}</p>
                      <p className="text-sm text-muted-foreground">{selectedOrder.phone_number || 'No phone'}</p>
                    </div>
                  </div>
                  
                  {fullAddress && <div className="flex items-start gap-2 pt-2 border-t border-border">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm text-muted-foreground">{fullAddress}</p>
                    </div>}
                </div>
              </Card>

              {/* Timestamps */}
              {(selectedOrder.assigned_at || selectedOrder.completed_at) && <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Timeline</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    {selectedOrder.assigned_at && <div className="flex justify-between">
                        <span className="text-muted-foreground">Assigned</span>
                        <span className="text-foreground">{formatDateTime(selectedOrder.assigned_at)}</span>
                      </div>}
                    {selectedOrder.in_route_at && <div className="flex justify-between">
                        <span className="text-muted-foreground">In Route</span>
                        <span className="text-foreground">{formatDateTime(selectedOrder.in_route_at)}</span>
                      </div>}
                    {selectedOrder.completed_at && <div className="flex justify-between">
                        <span className="text-muted-foreground">Completed</span>
                        <span className="text-foreground">{formatDateTime(selectedOrder.completed_at)}</span>
                      </div>}
                  </div>
                </Card>}

              {/* Delivery Outcome */}
              {selectedOrder.delivery_status && <Card className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Delivery Outcome</p>
                  <p className={cn("font-medium", selectedOrder.timeline_status === 'COMPLETED_DELIVERED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                    {selectedOrder.delivery_status.replace(/_/g, ' ')}
                  </p>
                </Card>}
            </div>}

          {/* Action Buttons */}
          {selectedOrder && <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t border-border space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="gap-2" onClick={handleViewLabel}>
                  <FileDown className="w-4 h-4" />
                  View Label
                </Button>
                <Button className="gap-2" onClick={handleNavigateToDelivery}>
                  Start Delivery
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>}
        </SheetContent>
      </Sheet>

      {/* Package Label Sheet */}
      <Sheet open={showLabelSheet} onOpenChange={setShowLabelSheet}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle className="text-lg">Package Label</SheetTitle>
          </SheetHeader>
          
          <div className="overflow-y-auto h-[calc(100%-4rem)] py-4">
            {selectedOrder && <PackageLabel order={selectedOrder} />}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>;
}