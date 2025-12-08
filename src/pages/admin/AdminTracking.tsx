import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Truck, MapPin, User, Phone, Mail, Calendar, Copy, Building, FileText, Hash, ExternalLink, CheckCircle2, Clock, Navigation, CircleDot, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Order, Profile } from '@/types/auth';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useToast } from '@/hooks/use-toast';

// Empty state component for missing data
const EmptyField = ({
  label
}: {
  label?: string;
}) => <span className="text-muted-foreground/60 italic text-sm">
    {label || 'Not provided'}
  </span>;

// Helper to render field value or empty state
const FieldValue = ({
  value,
  label
}: {
  value: string | null | undefined;
  label?: string;
}) => {
  if (!value || value.trim() === '') {
    return <EmptyField label={label} />;
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>;
};
export default function AdminTracking() {
  const {
    orderId
  } = useParams();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [driver, setDriver] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    setIsLoading(true);
    setError(null);
    try {
      const {
        data,
        error: orderError
      } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (orderError) throw orderError;
      if (data) {
        setOrder(data as Order);
        if (data.assigned_driver_id) {
          const {
            data: driverProfile
          } = await supabase.from('profiles').select('*').eq('id', data.assigned_driver_id).maybeSingle();
          if (driverProfile) {
            setDriver(driverProfile as Profile);
          }
        }
      } else {
        setError('Order not found.');
      }
    } catch (err) {
      setError('Failed to load order details.');
      console.error('Order fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);
  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase.channel(`admin-order-${orderId}`).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`
    }, payload => {
      setOrder(payload.new as Order);
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Pending',
          className: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      case 'PICKED_UP':
        return {
          label: 'Picked Up',
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'SHIPPED':
        return {
          label: 'Shipped',
          className: 'bg-purple-100 text-purple-800 border-purple-200'
        };
      case 'DELIVERED':
        return {
          label: 'Delivered',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      case 'DELIVERY_INCOMPLETE':
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
    if (order?.tracking_url) {
      navigator.clipboard.writeText(order.tracking_url);
      toast({
        title: "Copied",
        description: "Tracking URL copied to clipboard"
      });
    }
  };
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground mt-3">Loading order details...</p>
        </div>
      </div>;
  }
  if (error || !order) {
    return <div className="min-h-screen bg-background p-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center">
          <p className="text-destructive">{error || 'Order not found'}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
        </div>
      </div>;
  }
  const statusConfig = getStatusConfig(order.timeline_status);
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-base">Order Details</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/audit/${orderId}`)} className="text-sm bg-[sidebar-primary-foreground] bg-red-50 px-[8px]">
            Audit Trail
          </Button>
          <Badge className={statusConfig.className}>
            {statusConfig.label}
          </Badge>
        </div>
        {order.shipment_id && <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 mt-3">
            <Package className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Shipment ID</p>
              <p className="text-sm font-mono font-semibold text-foreground">{order.shipment_id}</p>
            </div>
          </div>}
      </div>

      <PullToRefresh onRefresh={fetchOrder}>
        <div className="px-4 pb-24">
          <div className="py-4 space-y-5">
            
            {/* Tracking Info Card */}
            {order.tracking_id ? <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
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
              </div> : <div className="bg-muted/30 rounded-xl p-4 border border-dashed border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Hash className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Tracking Number</p>
                    <p className="text-sm text-muted-foreground/60 italic">Not yet assigned</p>
                  </div>
                </div>
              </div>}

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

            {/* Timeline Status Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Delivery Timeline</h3>
              </div>
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="relative">
                {/* Timeline Line */}
                  <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border" />
                  
                  {/* Pending */}
                  <div className="relative flex items-start gap-3 pb-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${order.pending_at ? 'bg-amber-100 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                      <CircleDot className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-medium text-foreground">Pending</p>
                      <p className="text-xs text-muted-foreground">
                        {order.pending_at ? formatDateTime(order.pending_at) : 'Awaiting processing'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Picked Up */}
                  <div className="relative flex items-start gap-3 pb-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${order.picked_up_at ? 'bg-blue-100 text-blue-600' : 'bg-muted text-muted-foreground'}`}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-medium text-foreground">Picked Up</p>
                      <p className="text-xs text-muted-foreground">
                        {order.picked_up_at ? `Assigned ${formatDateTime(order.picked_up_at)}` : 'Not yet assigned'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Shipped */}
                  <div className="relative flex items-start gap-3 pb-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${order.shipped_at ? 'bg-purple-100 text-purple-600' : 'bg-muted text-muted-foreground'}`}>
                      <Navigation className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-medium text-foreground">Shipped</p>
                      <p className="text-xs text-muted-foreground">
                        {order.shipped_at ? formatDateTime(order.shipped_at) : 'Driver not started'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Delivered */}
                  <div className="relative flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${order.completed_at ? order.timeline_status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'}`}>
                      <Truck className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {order.timeline_status === 'DELIVERY_INCOMPLETE' ? 'Delivery Incomplete' : 'Delivered'}
                      </p>
                      {order.completed_at ? <div>
                          <p className="text-xs text-muted-foreground">{formatDateTime(order.completed_at)}</p>
                          {order.delivery_status && <Badge variant="secondary" className={`mt-1 text-[10px] ${order.timeline_status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                              {order.delivery_status.replace(/_/g, ' ')}
                            </Badge>}
                        </div> : <p className="text-xs text-muted-foreground">Awaiting delivery</p>}
                    </div>
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
                
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Health Card</p>
                    <FieldValue value={order.health_card} label="Not provided" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    {order.phone_number ? <a href={`tel:${order.phone_number}`} className="text-primary underline">{order.phone_number}</a> : <EmptyField label="No phone" />}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    {order.email ? <a href={`mailto:${order.email}`} className="text-primary underline truncate">{order.email}</a> : <EmptyField label="No email" />}
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
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Street</p>
                  <FieldValue value={order.address_1} label="No address" />
                  {order.address_2 && <p className="text-sm text-muted-foreground mt-0.5">{order.address_2}</p>}
                </div>
                
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
                
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Country</p>
                  <FieldValue value={order.country} label="Canada" />
                </div>
                
                {order.address_1 && <Button variant="outline" className="w-full mt-2" onClick={() => {
                const address = `${order.address_1}, ${order.city}, ${order.province} ${order.postal}`;
                window.open(`https://maps.google.com/maps?q=${encodeURIComponent(address)}`, '_blank');
              }}>
                    <MapPin className="w-4 h-4 mr-2" />
                    Open in Google Maps
                  </Button>}
              </div>
            </section>

            {/* Medication Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Medication</h3>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 space-y-3">
                <div className="text-center pb-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Naloxone Kit</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-700">N</span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Nasal</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{order.doses_nasal || 0}</p>
                    <p className="text-[10px] text-muted-foreground">doses</p>
                    {order.nasal_rx && <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-[10px] text-muted-foreground uppercase">RX #</p>
                        <p className="text-xs font-mono text-foreground">{order.nasal_rx}</p>
                      </div>}
                  </div>
                  
                  <div className="bg-background rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-emerald-700">I</span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Injectable</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{order.doses_injectable || 0}</p>
                    <p className="text-[10px] text-muted-foreground">doses</p>
                    {order.injection_rx && <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-[10px] text-muted-foreground uppercase">RX #</p>
                        <p className="text-xs font-mono text-foreground">{order.injection_rx}</p>
                      </div>}
                  </div>
                </div>
              </div>
            </section>

            {/* Pharmacy Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Building className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Pharmacy Details</h3>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Pharmacy</p>
                  <FieldValue value={order.pharmacy_name} label="Not specified" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Authorizing Pharmacist</p>
                  <FieldValue value={order.authorizing_pharmacist} label="Not specified" />
                </div>
                {order.training_status && <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Training Status</p>
                    <FieldValue value={order.training_status} />
                  </div>}
              </div>
            </section>

            {/* Assigned Driver Section */}
            {driver && <section>
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Assigned Driver</h3>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {driver.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'DR'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-bold">{driver.full_name || 'Unknown'}</p>
                      {driver.phone && <a href={`tel:${driver.phone}`} className="text-xs text-primary underline">{driver.phone}</a>}
                    </div>
                  </div>
                </div>
              </section>}

            {/* Delivery Outcome */}
            {order.delivery_status && <section>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Delivery Outcome</h3>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
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
      </PullToRefresh>
    </div>;
}