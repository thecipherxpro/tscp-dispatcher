import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Copy, ExternalLink, Truck, Eye, Hash, Calendar, FileDown } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Order, Profile } from '@/types/auth';
import { DriverAssignmentModal } from './DriverAssignmentModal';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface OrderDetailSheetProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  isAdmin?: boolean;
}

export function OrderDetailSheet({
  order,
  isOpen,
  onClose,
  onUpdate,
  isAdmin = false
}: OrderDetailSheetProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [driver, setDriver] = useState<Profile | null>(null);

  // Fetch driver info when order changes
  useEffect(() => {
    const fetchDriver = async () => {
      if (order?.assigned_driver_id) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', order.assigned_driver_id)
          .maybeSingle();
        setDriver(data as Profile | null);
      } else {
        setDriver(null);
      }
    };
    fetchDriver();
  }, [order?.assigned_driver_id]);

  if (!order) return null;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Pending',
          className: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      case 'PICKED_UP_AND_ASSIGNED':
        return {
          label: 'Assigned',
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'REVIEW_REQUESTED':
        return {
          label: 'Review Requested',
          className: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      case 'CONFIRMED':
        return {
          label: 'Confirmed',
          className: 'bg-indigo-100 text-indigo-800 border-indigo-200'
        };
      case 'IN_ROUTE':
        return {
          label: 'In Route',
          className: 'bg-purple-100 text-purple-800 border-purple-200'
        };
      case 'COMPLETED_DELIVERED':
        return {
          label: 'Delivered',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      case 'COMPLETED_INCOMPLETE':
        return {
          label: 'Incomplete',
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      default:
        return {
          label: status,
          className: ''
        };
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  const copyTrackingUrl = () => {
    if (order.tracking_url) {
      navigator.clipboard.writeText(order.tracking_url);
      toast({
        title: "Copied",
        description: "Tracking URL copied to clipboard"
      });
    }
  };

  const statusConfig = getStatusConfig(order.timeline_status);

  const handleViewDetails = () => {
    onClose();
    navigate(`/tracking/${order.id}`);
  };

  return (
    <>
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="max-h-[85vh]">
          {/* Header */}
          <DrawerHeader className="border-b border-border pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <DrawerTitle className="text-lg font-semibold">Order Overview</DrawerTitle>
                <Badge className={statusConfig.className}>
                  {statusConfig.label}
                </Badge>
              </div>
              {order.shipment_id && (
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Shipment ID</p>
                    <p className="text-sm font-mono font-semibold text-foreground">{order.shipment_id}</p>
                  </div>
                </div>
              )}
            </div>
          </DrawerHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-24">
            <div className="py-4 space-y-5">
              
              {/* Tracking Number */}
              {order.tracking_id ? (
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Hash className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Tracking Number</p>
                        <p className="font-mono font-semibold text-primary">{order.tracking_id}</p>
                      </div>
                    </div>
                    {order.tracking_url && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={copyTrackingUrl}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-muted/30 rounded-xl p-4 border border-dashed border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Hash className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Tracking Number</p>
                      <p className="text-sm text-muted-foreground/60 italic">Not yet assigned</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dates Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Dates</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Shipped Date</p>
                      <p className="text-sm font-medium text-foreground">
                        {order.shipped_at ? formatDateTime(order.shipped_at) : 'Not shipped'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Billing Date</p>
                      <p className="text-sm font-medium text-foreground">
                        {order.billing_date ? formatDate(order.billing_date) : 'Not set'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Order Status Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Order Status</h3>
                </div>
                <div className={`rounded-xl p-4 border ${
                  order.timeline_status === 'COMPLETED_DELIVERED' 
                    ? 'bg-emerald-50 border-emerald-200'
                    : order.timeline_status === 'COMPLETED_INCOMPLETE'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-muted/30 border-border'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Current Status</p>
                      <Badge className={`${statusConfig.className} text-sm px-3 py-1`}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    {order.delivery_status && (
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Delivery Outcome</p>
                        <p className="text-sm font-medium text-foreground">
                          {order.delivery_status.replace(/_/g, ' ')}
                        </p>
                      </div>
                    )}
                  </div>
                  {order.assigned_driver_id && driver && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Assigned to:</span>
                        <span className="text-sm font-medium text-foreground">{driver.full_name}</span>
                        {driver.driver_id && (
                          <span className="text-xs font-mono text-primary">({driver.driver_id})</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Package Label Section - Placeholder */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <FileDown className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Package Label</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-6 border border-dashed border-border">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                      <FileDown className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Package Label Preview</p>
                    <p className="text-xs text-muted-foreground/70 mb-4">PDF label will appear here</p>
                    <Button variant="outline" size="sm" disabled className="gap-2">
                      <FileDown className="w-4 h-4" />
                      Download Label
                    </Button>
                  </div>
                </div>
              </section>

            </div>
          </div>

          {/* Sticky Bottom Actions */}
          {isAdmin && (
            <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-safe">
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="h-12 font-medium" 
                  onClick={() => setShowAssignModal(true)} 
                  disabled={order.timeline_status !== 'PENDING'}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Assign
                </Button>
                <Button className="h-12 font-medium" onClick={handleViewDetails}>
                  <Eye className="w-4 h-4 mr-2" />
                  Order Details
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <DriverAssignmentModal 
        order={order} 
        isOpen={showAssignModal} 
        onClose={() => setShowAssignModal(false)} 
        onSuccess={() => {
          setShowAssignModal(false);
          onUpdate();
          onClose();
        }} 
      />
    </>
  );
}
