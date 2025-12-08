import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Package, Clock, Copy, ExternalLink, Truck, Eye, Phone, Mail, Calendar, Hash, FileText } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Order } from '@/types/auth';
import { DriverAssignmentModal } from './DriverAssignmentModal';
import { useToast } from '@/hooks/use-toast';
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
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const [showAssignModal, setShowAssignModal] = useState(false);
  if (!order) return null;
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Pending',
          variant: 'secondary' as const,
          className: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      case 'CONFIRMED':
        return {
          label: 'Confirmed',
          variant: 'secondary' as const,
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'IN_ROUTE':
        return {
          label: 'In Route',
          variant: 'secondary' as const,
          className: 'bg-purple-100 text-purple-800 border-purple-200'
        };
      case 'ARRIVED':
        return {
          label: 'Arrived',
          variant: 'secondary' as const,
          className: 'bg-indigo-100 text-indigo-800 border-indigo-200'
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          variant: 'secondary' as const,
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      case 'REQUEST_ADDRESS_REVIEW':
        return {
          label: 'Address Review',
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      default:
        return {
          label: status,
          variant: 'outline' as const,
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
  const handleViewTracking = () => {
    onClose();
    if (order.tracking_id) {
      window.open(`/track/${order.tracking_id}`, '_blank');
    }
  };
  return <>
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="max-h-[90vh]">
          {/* Header */}
          <DrawerHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DrawerTitle className="text-lg font-semibold">Order Details</DrawerTitle>
                {order.shipment_id && <p className="text-sm font-mono text-muted-foreground">{order.shipment_id}</p>}
              </div>
              <Badge className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            </div>
          </DrawerHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-24">
            <div className="py-4 space-y-5">
              
              {/* Tracking Info Card */}
              {order.tracking_id && <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
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
                    {order.tracking_url && <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={copyTrackingUrl}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>}
                  </div>
                </div>}

              {/* Client Information Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Client Information</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {order.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'NA'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{order.name || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">DOB: {formatDate(order.dob)}</p>
                    </div>
                  </div>
                  
                  <Separator className="bg-border/50" />
                  
                  <div className="grid grid-cols-1 gap-2">
                    {order.phone_number && <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{order.phone_number}</span>
                      </div>}
                    {order.email && <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground truncate">{order.email}</span>
                      </div>}
                  </div>
                </div>
              </section>

              {/* Delivery Address Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Delivery Address</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="text-sm text-foreground space-y-0.5">
                    <p className="font-medium">{order.address_1}</p>
                    {order.address_2 && <p className="text-muted-foreground">{order.address_2}</p>}
                    <p>{order.city}, {order.province} {order.postal}</p>
                    <p className="text-muted-foreground">{order.country || 'Canada'}</p>
                  </div>
                </div>
              </section>

              {/* Medication Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Medication</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 space-y-3">
                  {/* Medication Type Header */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">Naloxone Kit</p>
                    </div>
                  </div>

                  {/* Dose Types - Compact Row Layout */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Nasal Dose */}
                    <div className="bg-background rounded-lg p-2.5 border border-border/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-blue-100 text-blue-700 border-blue-200">
                          Nasal
                        </Badge>
                        <span className="text-lg font-bold text-foreground">{order.doses_nasal || 0}</span>
                      </div>
                      {order.nasal_rx && <div className="border-t border-border/50 pt-1.5 mt-1 mx-0 py-[4px] px-[3px] rounded-3xl bg-primary-foreground">
                          <p className="text-[10px] text-muted-foreground leading-none">RX</p>
                          <p className="text-xs font-mono font-medium text-foreground truncate">{order.nasal_rx}</p>
                        </div>}
                    </div>

                    {/* Injectable Dose */}
                    <div className="bg-background rounded-lg p-2.5 border border-border/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-emerald-100 text-emerald-700 border-emerald-200">
                          Injectable
                        </Badge>
                        <span className="text-lg font-bold text-foreground">{order.doses_injectable || 0}</span>
                      </div>
                      {order.injection_rx && <div className="border-t border-border/50 pt-1.5 mt-1">
                          <p className="text-[10px] text-muted-foreground leading-none">RX</p>
                          <p className="text-xs font-mono font-medium text-foreground truncate">{order.injection_rx}</p>
                        </div>}
                    </div>
                  </div>
                </div>
              </section>

              {/* Timeline Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="space-y-2">
                    {[{
                    label: 'Pending',
                    time: order.pending_at
                  }, {
                    label: 'Confirmed',
                    time: order.confirmed_at
                  }, {
                    label: 'In Route',
                    time: order.in_route_at
                  }, {
                    label: 'Arrived',
                    time: order.arrived_at
                  }, {
                    label: 'Completed',
                    time: order.completed_at
                  }].filter(item => item.time).map((item, index) => <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="text-foreground font-medium">{formatDateTime(item.time)}</span>
                      </div>)}
                  </div>
                </div>
              </section>

              {/* Delivery Status */}
              {order.delivery_status && <section>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-900">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Delivery Outcome</p>
                        <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                          {order.delivery_status.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>}

              {/* Notes Section */}
              {order.call_notes && <section>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Notes</h3>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4">
                    <p className="text-sm text-foreground">{order.call_notes}</p>
                  </div>
                </section>}
            </div>
          </div>

          {/* Sticky Bottom Actions */}
          {isAdmin && <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-safe">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12 font-medium" onClick={() => setShowAssignModal(true)} disabled={order.timeline_status !== 'PENDING'}>
                  <Truck className="w-4 h-4 mr-2" />
                  Assign
                </Button>
                <Button className="h-12 font-medium" onClick={handleViewTracking} disabled={!order.tracking_id}>
                  <Eye className="w-4 h-4 mr-2" />
                  Track
                </Button>
              </div>
            </div>}
        </DrawerContent>
      </Drawer>

      <DriverAssignmentModal order={order} isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} onSuccess={() => {
      setShowAssignModal(false);
      onUpdate();
      onClose();
    }} />
    </>;
}