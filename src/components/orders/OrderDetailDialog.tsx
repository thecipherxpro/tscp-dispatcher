import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Copy, ExternalLink, Truck, Eye, Hash, Calendar, FileDown, X, MapPin, Mail, Phone, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Order, Profile } from '@/types/auth';
import { DriverAssignmentModal } from './DriverAssignmentModal';
import { PackageLabel } from './PackageLabel';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

interface OrderDetailDialogProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  isAdmin?: boolean;
}

export function OrderDetailDialog({
  order,
  isOpen,
  onClose,
  onUpdate,
  isAdmin = false
}: OrderDetailDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showUnassignDialog, setShowUnassignDialog] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [driver, setDriver] = useState<Profile | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  // Fetch driver info and recent logs when order changes
  useEffect(() => {
    const fetchData = async () => {
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

      if (order?.id) {
        const { data: logs } = await supabase
          .from('order_audit_logs')
          .select('id, action, created_at, user_full_name, new_status')
          .eq('order_id', order.id)
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentLogs(logs || []);
      }
    };
    fetchData();
  }, [order?.assigned_driver_id, order?.id]);

  if (!order) return null;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'PICKED_UP_AND_ASSIGNED':
        return { label: 'Assigned', className: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'REVIEW_REQUESTED':
        return { label: 'Review Requested', className: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'CONFIRMED':
        return { label: 'Confirmed', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'IN_ROUTE':
        return { label: 'In Route', className: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'COMPLETED_DELIVERED':
        return { label: 'Delivered', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'COMPLETED_INCOMPLETE':
        return { label: 'Incomplete', className: 'bg-red-100 text-red-800 border-red-200' };
      default:
        return { label: status, className: '' };
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set';
    const parsed = new Date(date + 'T00:00:00');
    return parsed.toLocaleDateString('en-CA', {
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

  const handleViewAuditTrail = () => {
    onClose();
    navigate(`/admin/orders/${order.id}/audit`);
  };

  const handleUnassignDriver = async () => {
    if (!order) return;
    
    setIsUnassigning(true);
    try {
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          assigned_driver_id: null,
          timeline_status: 'PENDING',
          picked_up_at: null,
          assigned_at: null,
          confirmed_at: null,
          in_route_at: null,
          arrived_at: null,
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      await supabase
        .from('public_tracking')
        .update({
          driver_id: null,
          timeline_status: 'PENDING',
          picked_up_at: null,
          assigned_at: null,
          confirmed_at: null,
          in_route_at: null,
          arrived_at: null,
        })
        .eq('order_id', order.id);

      toast({
        title: "Driver Unassigned",
        description: "The driver has been removed from this order.",
      });

      setShowUnassignDialog(false);
      onUpdate();
    } catch (err) {
      console.error('Error unassigning driver:', err);
      toast({
        title: "Error",
        description: "Failed to unassign driver. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUnassigning(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <DialogTitle className="text-xl font-semibold">Order Details</DialogTitle>
                <Badge className={statusConfig.className}>
                  {statusConfig.label}
                </Badge>
              </div>
              {order.shipment_id && (
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-mono font-semibold">{order.shipment_id}</span>
                </div>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-180px)]">
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
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

                {/* Customer Info */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Customer Information</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Name</p>
                      <p className="text-sm font-medium text-foreground">{order.client_name || 'Not provided'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          Phone
                        </p>
                        <p className="text-sm text-foreground">{order.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          Email
                        </p>
                        <p className="text-sm text-foreground">{order.email || 'Not provided'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Health Card</p>
                      <p className="text-sm text-foreground">{order.health_card_no || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Delivery Address</h3>
                  </div>
                  <p className="text-sm text-foreground">{order.address_line_1 || 'Not provided'}</p>
                  {order.address_line_2 && <p className="text-sm text-foreground">{order.address_line_2}</p>}
                  {order.geo_zone && (
                    <Badge variant="outline" className="mt-2">{order.geo_zone}</Badge>
                  )}
                </div>

                {/* Dates */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Dates</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Order Date</p>
                      <p className="text-sm font-medium text-foreground">
                        {order.order_date ? formatDate(order.order_date) : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Shipped</p>
                      <p className="text-sm font-medium text-foreground">
                        {order.shipped_at ? formatDateTime(order.shipped_at) : 'Not shipped'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Order Status */}
                <div className={`rounded-xl p-4 border ${
                  order.timeline_status === 'COMPLETED_DELIVERED' ? 'bg-emerald-50 border-emerald-200' :
                  order.timeline_status === 'COMPLETED_INCOMPLETE' ? 'bg-red-50 border-red-200' :
                  'bg-muted/30 border-border'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Order Status</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Current Status</p>
                      <Badge className={`${statusConfig.className} text-sm px-3 py-1`}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    {order.delivery_status && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Outcome</p>
                        <p className="text-sm font-medium text-foreground">
                          {order.delivery_status.replace(/_/g, ' ')}
                        </p>
                      </div>
                    )}
                  </div>
                  {driver && isAdmin && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Driver:</span>
                          <span className="text-sm font-medium text-foreground">{driver.full_name}</span>
                          {driver.driver_id && <span className="text-xs font-mono text-primary">({driver.driver_id})</span>}
                        </div>
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-colors"
                          onClick={() => setShowUnassignDialog(true)}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Unassign
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>

                {/* Medication Details */}
                {(order.injection_drug_name || order.injection_rx_number || order.nasal_drug_name || order.nasal_rx_number || order.naloxone_kit_x4_drug_name || order.naloxone_kit_x4_qty) && (
                  <div className="bg-muted/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Medication Details</h3>
                    </div>
                    <div className="space-y-3">
                      {(order.injection_drug_name || order.injection_rx_number) && (
                        <div className="bg-background/50 rounded-lg p-3">
                          <p className="text-xs uppercase tracking-wide mb-2 font-semibold text-ring">Injection</p>
                          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                            {order.injection_rx_number && <p><span className="text-muted-foreground">Rx:</span> {order.injection_rx_number}</p>}
                            {order.injection_din && <p><span className="text-muted-foreground">DIN:</span> {order.injection_din}</p>}
                            {order.injection_qty && <p><span className="text-muted-foreground">Qty:</span> {order.injection_qty}</p>}
                            {order.injection_drug_name && <p className="col-span-3"><span className="text-muted-foreground">Drug:</span> {order.injection_drug_name}</p>}
                          </div>
                        </div>
                      )}
                      {(order.nasal_drug_name || order.nasal_rx_number) && (
                        <div className="bg-background/50 rounded-lg p-3">
                          <p className="text-xs uppercase tracking-wide mb-2 font-semibold text-ring">Nasal</p>
                          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                            {order.nasal_rx_number && <p><span className="text-muted-foreground">Rx:</span> {order.nasal_rx_number}</p>}
                            {order.nasal_din && <p><span className="text-muted-foreground">DIN:</span> {order.nasal_din}</p>}
                            {order.nasal_qty && <p><span className="text-muted-foreground">Qty:</span> {order.nasal_qty}</p>}
                            {order.nasal_drug_name && <p className="col-span-3"><span className="text-muted-foreground">Drug:</span> {order.nasal_drug_name}</p>}
                          </div>
                        </div>
                      )}
                      {(order.naloxone_kit_x4_drug_name || order.naloxone_kit_x4_qty) && (
                        <div className="bg-background/50 rounded-lg p-3">
                          <p className="text-xs uppercase tracking-wide mb-2 font-semibold text-ring">Naloxone Kit X4</p>
                          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                            {order.naloxone_kit_x4_qty && <p><span className="text-muted-foreground">Qty:</span> {order.naloxone_kit_x4_qty}</p>}
                            {order.naloxone_kit_x4_drug_name && <p className="col-span-3"><span className="text-muted-foreground">Drug:</span> {order.naloxone_kit_x4_drug_name}</p>}
                            {order.naloxone_kit_x4_includes && <p className="col-span-3"><span className="text-muted-foreground">Includes:</span> {order.naloxone_kit_x4_includes}</p>}
                            {order.naloxone_kit_x4_type && <p><span className="text-muted-foreground">Type:</span> {order.naloxone_kit_x4_type}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {order.notes && (
                  <div className="bg-muted/30 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes}</p>
                  </div>
                )}

                {/* Recent Activity */}
                {recentLogs.length > 0 && (
                  <div className="bg-muted/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleViewAuditTrail}>
                        View All
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {recentLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{log.action.replace(/_/g, ' ')}</span>
                          <span className="text-muted-foreground">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Package Label Section */}
            <div className="px-6 pb-6">
              <Separator className="mb-6" />
              <div className="flex items-center gap-2 mb-4">
                <FileDown className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Package Label</h3>
              </div>
              <PackageLabel order={order} />
            </div>
          </ScrollArea>

          {/* Footer Actions */}
          {isAdmin && (
            <div className="p-4 border-t bg-muted/30 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowAssignModal(true)} disabled={order.timeline_status !== 'PENDING'}>
                <Truck className="w-4 h-4 mr-2" />
                Assign Driver
              </Button>
              <Button variant="outline" onClick={handleViewAuditTrail}>
                <Eye className="w-4 h-4 mr-2" />
                Audit Trail
              </Button>
              <Button onClick={handleViewDetails}>
                <Eye className="w-4 h-4 mr-2" />
                Full Details
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Driver Assignment Modal */}
      <DriverAssignmentModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        order={order}
        onSuccess={() => {
          setShowAssignModal(false);
          onUpdate();
        }}
      />

      {/* Unassign Confirmation */}
      <AlertDialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign Driver</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign the driver from this order? 
              The order will be returned to Pending status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUnassignDriver}
              disabled={isUnassigning}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnassigning ? 'Unassigning...' : 'Unassign'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
