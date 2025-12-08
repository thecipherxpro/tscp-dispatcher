import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Package, Copy, ExternalLink, Truck, Eye, Phone, Mail, Hash, FileText, Building, GraduationCap, AlertCircle, Calendar } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Order, Profile } from '@/types/auth';
import { DriverAssignmentModal } from './DriverAssignmentModal';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Empty state component for missing data
const EmptyField = ({ label }: { label?: string }) => (
  <span className="text-muted-foreground/60 italic text-sm">
    {label || 'Not provided'}
  </span>
);

// Helper to render field value or empty state
const FieldValue = ({ value, label }: { value: string | null | undefined; label?: string }) => {
  if (!value || value.trim() === '') {
    return <EmptyField label={label} />;
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>;
};
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
          variant: 'secondary' as const,
          className: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      case 'PICKED_UP':
        return {
          label: 'Picked Up',
          variant: 'secondary' as const,
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'SHIPPED':
        return {
          label: 'Shipped',
          variant: 'secondary' as const,
          className: 'bg-purple-100 text-purple-800 border-purple-200'
        };
      case 'DELIVERED':
        return {
          label: 'Delivered',
          variant: 'secondary' as const,
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      case 'DELIVERY_INCOMPLETE':
        return {
          label: 'Incomplete',
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
  const handleViewDetails = () => {
    onClose();
    navigate(`/tracking/${order.id}`);
  };
  return <>
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="max-h-[90vh]">
          {/* Header */}
          <DrawerHeader className="border-b border-border pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <DrawerTitle className="text-lg font-semibold">Order Details</DrawerTitle>
                <Badge className={statusConfig.className}>
                  {statusConfig.label}
                </Badge>
              </div>
              {order.shipment_id && <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium text-justify">Shipment ID</p>
                    <p className="text-sm font-mono font-semibold text-foreground text-justify">{order.shipment_id}</p>
                  </div>
                </div>}
            </div>
          </DrawerHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-24">
            <div className="py-4 space-y-5">
              
              {/* Tracking Info Card */}
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

              {/* Ship & Billing Dates Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Dates</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Shipped Date</p>
                      <FieldValue value={order.shipped_at ? formatDateTime(order.shipped_at) : null} label="Not shipped" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Billing Date</p>
                      <FieldValue value={order.billing_date ? formatDate(order.billing_date) : null} label="Not set" />
                    </div>
                  </div>
                </div>
              </section>


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
                      <p className="text-foreground truncate font-bold">
                        {order.name || <EmptyField label="No name" />}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        DOB: {order.dob ? formatDate(order.dob) : <span className="italic text-muted-foreground/60">Not provided</span>}
                      </p>
                    </div>
                  </div>
                  
                  <Separator className="bg-border/50" />
                  
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      {order.phone_number ? (
                        <span className="text-foreground">{order.phone_number}</span>
                      ) : (
                        <EmptyField label="No phone" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      {order.email ? (
                        <span className="text-foreground truncate">{order.email}</span>
                      ) : (
                        <EmptyField label="No email" />
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Delivery Address Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Delivery Address</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  {/* Street Address */}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Street</p>
                    <FieldValue value={order.address_1} label="No address" />
                    {order.address_2 && (
                      <p className="text-sm text-muted-foreground mt-0.5">{order.address_2}</p>
                    )}
                  </div>
                  
                  {/* City, Province, Postal */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">City</p>
                      <FieldValue value={order.city} label="—" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Province</p>
                      <FieldValue value={order.province} label="—" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Postal</p>
                      <FieldValue value={order.postal} label="—" />
                    </div>
                  </div>
                  
                  {/* Country */}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Country</p>
                    <FieldValue value={order.country} label="Canada" />
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
                      {order.nasal_rx && <div className="border-t border-border/50 pt-1.5 mt-1 mx-0 py-[4px] rounded-xl bg-[#ebf4ff] px-[8px]">
                          <p className="text-[10px] text-muted-foreground leading-none font-semibold">RX</p>
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

              {/* Pharmacy Details Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Pharmacy Details</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  {/* Pharmacy Name */}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Pharmacy</p>
                    <FieldValue value={order.pharmacy_name} label="Not assigned" />
                  </div>
                  
                  {/* Authorizing Pharmacist & Training Status */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Authorizing Pharmacist</p>
                      <FieldValue value={order.authorizing_pharmacist} label="Not assigned" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Training Status</p>
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                        <FieldValue value={order.training_status} label="Unknown" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Driver Assignment Section */}
              {order.assigned_driver_id && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Assigned Driver</h3>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          {driver?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'DR'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate font-bold">
                          {driver?.full_name || 'Loading...'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {driver?.driver_id && (
                            <span className="font-mono text-primary font-semibold">{driver.driver_id}</span>
                          )}
                          {driver?.driver_id && driver?.phone && <span>•</span>}
                          {driver?.phone && <span>{driver.phone}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {order.delivery_status && <section>
                  <div className={`rounded-xl p-4 border ${
                    order.timeline_status === 'DELIVERED' 
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        order.timeline_status === 'DELIVERED'
                          ? 'bg-emerald-100 dark:bg-emerald-900'
                          : 'bg-red-100 dark:bg-red-900'
                      }`}>
                        <FileText className={`w-5 h-5 ${
                          order.timeline_status === 'DELIVERED'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`} />
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${
                          order.timeline_status === 'DELIVERED'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          Delivery Outcome
                        </p>
                        <p className={`font-semibold ${
                          order.timeline_status === 'DELIVERED'
                            ? 'text-emerald-900 dark:text-emerald-100'
                            : 'text-red-900 dark:text-red-100'
                        }`}>
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
                <Button className="h-12 font-medium" onClick={handleViewDetails}>
                  <Eye className="w-4 h-4 mr-2" />
                  Details
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