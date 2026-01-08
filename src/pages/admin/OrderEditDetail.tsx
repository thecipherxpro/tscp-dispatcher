import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { MobileNav } from '@/components/layout/MobileNav';
import { DesktopNav } from '@/components/layout/DesktopNav';
import { PackageLabel } from '@/components/orders/PackageLabel';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { createAuditLog } from '@/hooks/useAuditLog';
import { Order as FullOrder } from '@/types/auth';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  Phone,
  Calendar,
  Truck,
  CheckCircle,
  Navigation,
  AlertTriangle,
  Download,
  Copy,
  FileText,
  Clock,
  UserPlus,
  Tag,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const SYSTEM_DRIVER_ID = 'D0767';

const deliveryOutcomes = [
  { value: 'SUCCESSFULLY_DELIVERED', label: 'Successfully Delivered', success: true },
  { value: 'PACKAGE_DELIVERED_TO_CLIENT', label: 'Package Delivered to Client', success: true },
  { value: 'CLIENT_UNAVAILABLE', label: 'Client Unavailable', success: false },
  { value: 'NO_ONE_HOME', label: 'No One Home', success: false },
  { value: 'WRONG_ADDRESS', label: 'Wrong Address', success: false },
  { value: 'ADDRESS_INCORRECT', label: 'Address Incorrect', success: false },
  { value: 'SAFETY_CONCERN', label: 'Safety Concern', success: false },
  { value: 'UNSAFE_LOCATION', label: 'Unsafe Location', success: false },
  { value: 'OTHER', label: 'Other', success: false },
];

interface DriverInfo {
  id: string;
  full_name: string | null;
  driver_id: string | null;
  phone: string | null;
}

interface AuditLog {
  id: string;
  action: string;
  created_at: string;
  user_full_name: string | null;
  new_status: string | null;
}

export default function OrderEditDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const orderId = searchParams.get('id');

  const [order, setOrder] = useState<FullOrder | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  // Edit form state
  const [editPickedUpAt, setEditPickedUpAt] = useState('');
  const [editShippedAt, setEditShippedAt] = useState('');
  const [editCompletedAt, setEditCompletedAt] = useState('');
  const [editDeliveryStatus, setEditDeliveryStatus] = useState('');

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;

    setIsLoading(true);
    try {
      // Try to find by shipment_id, tracking_id, or id
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`shipment_id.eq.${orderId},tracking_id.eq.${orderId},id.eq.${orderId}`)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('Order not found');
        navigate('/admin/order-edits');
        return;
      }

      setOrder(data as unknown as FullOrder);

      // Initialize edit form
      setEditPickedUpAt(data.picked_up_at ? new Date(data.picked_up_at).toISOString().slice(0, 16) : '');
      setEditShippedAt(data.shipped_at || data.in_route_at ? new Date(data.shipped_at || data.in_route_at!).toISOString().slice(0, 16) : '');
      setEditCompletedAt(data.completed_at ? new Date(data.completed_at).toISOString().slice(0, 16) : '');
      setEditDeliveryStatus(data.delivery_status || '');

      // Fetch driver if assigned
      if (data.assigned_driver_id) {
        const { data: driverData } = await supabase
          .from('profiles')
          .select('id, full_name, driver_id, phone')
          .eq('id', data.assigned_driver_id)
          .maybeSingle();

        if (driverData) {
          setDriver(driverData);
        }
      }

      // Fetch audit logs
      const { data: logsData } = await supabase
        .from('order_audit_logs')
        .select('id, action, created_at, user_full_name, new_status')
        .eq('order_id', data.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (logsData) {
        setAuditLogs(logsData);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Failed to load order');
    } finally {
      setIsLoading(false);
    }
  }, [orderId, navigate]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleAssignSystemDriver = async () => {
    if (!order) return;

    setIsAssigning(true);
    try {
      // Find the system driver by driver_id
      const { data: driverData, error: driverError } = await supabase
        .from('profiles')
        .select('id, full_name, driver_id, phone')
        .eq('driver_id', SYSTEM_DRIVER_ID)
        .maybeSingle();

      if (driverError || !driverData) {
        toast.error('System driver not found');
        return;
      }

      const now = new Date().toISOString();
      let shipmentId = order.shipment_id;
      let trackingId = order.tracking_id;
      let trackingUrl = order.tracking_url;

      // Generate tracking if not exists
      if (!shipmentId || !trackingId) {
        const { data: shipmentIdData } = await supabase.rpc('generate_shipment_id');
        shipmentId = shipmentIdData as string;

        const { data: trackingIdData } = await supabase.rpc('generate_tracking_id');
        trackingId = trackingIdData as string;

        trackingUrl = `${window.location.origin}/track/${trackingId}`;
      }

      // Get client initials
      const { data: initialsData } = await supabase.rpc('get_client_initials', {
        full_name: order.client_name || ''
      });
      const clientInitials = initialsData as string;

      // Extract city from warehouse address for public tracking
      const warehouseAddress = order.warehouse_address || '';
      const warehouseParts = warehouseAddress.split(',').map(p => p.trim());
      const warehouseCity = warehouseParts.length >= 2 ? warehouseParts[warehouseParts.length - 2] : warehouseParts[0] || null;

      // Update order with driver assignment and tracking
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          assigned_driver_id: driverData.id,
          timeline_status: 'PICKED_UP_AND_ASSIGNED',
          picked_up_at: now,
          assigned_at: now,
          shipment_id: shipmentId,
          tracking_id: trackingId,
          tracking_url: trackingUrl,
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // Upsert public_tracking entry
      await supabase
        .from('public_tracking')
        .upsert({
          tracking_id: trackingId,
          tracking_url: trackingUrl,
          shipment_id: shipmentId,
          order_id: order.id,
          driver_id: driverData.id,
          client_initials: clientInitials,
          injection_qty: order.injection_qty,
          nasal_qty: order.nasal_qty,
          warehouse_city: warehouseCity,
          country: order.country || 'Canada',
          latitude: order.latitude,
          longitude: order.longitude,
          geo_zone: order.geo_zone,
          timeline_status: 'PICKED_UP_AND_ASSIGNED',
          pending_at: order.pending_at || now,
          picked_up_at: now,
          assigned_at: now,
        }, {
          onConflict: 'tracking_id'
        });

      // Create audit log
      await createAuditLog({
        orderId: order.id,
        action: 'ORDER_ASSIGNED',
        previousStatus: order.timeline_status || undefined,
        newStatus: 'PICKED_UP_AND_ASSIGNED',
        metadata: { 
          assigned_driver: driverData.full_name, 
          driver_id: SYSTEM_DRIVER_ID,
          tracking_generated: !order.tracking_id,
          shipment_id: shipmentId,
          tracking_id: trackingId,
        },
      });

      toast.success(`Assigned to ${driverData.full_name} with tracking generated`);
      await fetchOrder();
    } catch (error) {
      console.error('Error assigning driver:', error);
      toast.error('Failed to assign driver');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSaveDelivery = async () => {
    if (!order) return;

    setIsSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      const publicUpdates: Record<string, unknown> = {};

      // Determine timeline status based on what's filled
      let newTimelineStatus = order.timeline_status;

      if (editPickedUpAt) {
        updates.picked_up_at = new Date(editPickedUpAt).toISOString();
        updates.assigned_at = new Date(editPickedUpAt).toISOString();
        publicUpdates.picked_up_at = updates.picked_up_at;
        publicUpdates.assigned_at = updates.assigned_at;
        if (!editShippedAt && !editCompletedAt) {
          newTimelineStatus = 'PICKED_UP_AND_ASSIGNED';
        }
      }

      if (editShippedAt) {
        updates.shipped_at = new Date(editShippedAt).toISOString();
        updates.in_route_at = new Date(editShippedAt).toISOString();
        publicUpdates.shipped_at = updates.shipped_at;
        publicUpdates.in_route_at = updates.in_route_at;
        if (!editCompletedAt) {
          newTimelineStatus = 'IN_ROUTE';
        }
      }

      if (editCompletedAt && editDeliveryStatus) {
        updates.completed_at = new Date(editCompletedAt).toISOString();
        updates.delivery_status = editDeliveryStatus;
        publicUpdates.completed_at = updates.completed_at;
        publicUpdates.delivery_status = editDeliveryStatus;

        const isSuccess = deliveryOutcomes.find(o => o.value === editDeliveryStatus)?.success;
        newTimelineStatus = isSuccess ? 'COMPLETED_DELIVERED' : 'COMPLETED_INCOMPLETE';
      }

      updates.timeline_status = newTimelineStatus;
      publicUpdates.timeline_status = newTimelineStatus;

      // Update order
      const { error: updateError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', order.id);

      if (updateError) throw updateError;

      // Update public_tracking
      await supabase
        .from('public_tracking')
        .update(publicUpdates)
        .eq('order_id', order.id);

      // Create audit log
      await createAuditLog({
        orderId: order.id,
        action: 'DELIVERY_EDITED',
        previousStatus: order.timeline_status || undefined,
        newStatus: newTimelineStatus || undefined,
        deliveryStatus: editDeliveryStatus || undefined,
        metadata: { edited_by_admin: true },
      });

      toast.success('Delivery timeline updated');
      await fetchOrder();
    } catch (error) {
      console.error('Error saving delivery:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const downloadLabel = async () => {
    const labelElement = document.getElementById('package-label-preview');
    if (!labelElement) return;

    try {
      const canvas = await html2canvas(labelElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: [4, 6] });
      pdf.addImage(imgData, 'PNG', 0, 0, 6, 4);
      pdf.save(`label-${order?.shipment_id || order?.tracking_id}.pdf`);
      toast.success('Label downloaded');
    } catch (error) {
      toast.error('Failed to download label');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background border-b">
          <div className="flex items-center gap-3 px-4 h-14">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-6 w-40" />
          </div>
        </header>
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const isAssigned = !!order.assigned_driver_id;
  const isCompleted = order.timeline_status === 'COMPLETED_DELIVERED' || 
                      order.timeline_status === 'COMPLETED_INCOMPLETE';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="hidden lg:block">
              <DesktopNav title="Order Edit" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => navigate('/admin/order-edits')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-sm lg:text-base">
                {order.shipment_id || order.tracking_id}
              </h1>
              <p className="text-xs text-muted-foreground">{order.client_name}</p>
            </div>
          </div>
          <Badge
            className={
              isCompleted
                ? order.timeline_status === 'COMPLETED_DELIVERED'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
                : isAssigned
                ? 'bg-blue-100 text-blue-800'
                : 'bg-amber-100 text-amber-800'
            }
          >
            {order.timeline_status?.replace(/_/g, ' ') || 'Pending'}
          </Badge>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 rounded-none border-b bg-background h-12">
          <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Details
          </TabsTrigger>
          <TabsTrigger value="edit" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Edit Delivery
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="flex-1 overflow-y-auto pb-20 lg:pb-6 mt-0">
          <div className="p-4 space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
            {!isAssigned ? (
              /* Not Assigned State */
              <Card className="lg:col-span-2">
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Order Not Assigned</h3>
                  <p className="text-muted-foreground mb-4">
                    This order has not been assigned to a driver yet.
                  </p>
                  <Button onClick={handleAssignSystemDriver} disabled={isAssigning}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {isAssigning ? 'Assigning...' : 'Assign to System Driver'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Will assign to driver {SYSTEM_DRIVER_ID}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Order Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Order Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Shipment ID</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{order.shipment_id || '-'}</span>
                        {order.shipment_id && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(order.shipment_id!)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tracking ID</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{order.tracking_id || '-'}</span>
                        {order.tracking_id && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(order.tracking_id!)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{order.client_name}</p>
                        {order.email && <p className="text-xs text-muted-foreground">{order.email}</p>}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm">{order.address_line_1}</p>
                        {order.address_line_2 && <p className="text-sm">{order.address_line_2}</p>}
                        <p className="text-xs text-muted-foreground">{order.geo_zone}, {order.country}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Ordered: {order.order_date ? new Date(order.order_date).toLocaleDateString() : '-'}
                      </span>
                    </div>
                    {(order.injection_drug_name || order.nasal_drug_name) && (
                      <>
                        <Separator />
                        <div className="text-sm space-y-1">
                          {order.injection_drug_name && (
                            <p>💉 {order.injection_drug_name} x{order.injection_qty}</p>
                          )}
                          {order.nasal_drug_name && (
                            <p>👃 {order.nasal_drug_name} x{order.nasal_qty}</p>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Driver Info */}
                {driver && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Driver Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{driver.full_name}</p>
                          <Badge variant="secondary" className="text-xs">
                            {driver.driver_id}
                          </Badge>
                        </div>
                      </div>
                      {driver.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{driver.phone}</span>
                        </div>
                      )}
                      {order.picked_up_at && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            Assigned: {new Date(order.picked_up_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Package Label */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Package Label
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={downloadLabel}>
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div id="package-label-preview" className="transform scale-75 origin-top-left lg:scale-100">
                      <PackageLabel order={order} />
                    </div>
                  </CardContent>
                </Card>

                {/* Audit Trail */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Recent Activity
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/admin/audit?order=${order.id}`)}>
                        View Full Audit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {auditLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity recorded</p>
                    ) : (
                      <div className="space-y-2">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                            <div>
                              <p className="font-medium">{log.action.replace(/_/g, ' ')}</p>
                              <p className="text-xs text-muted-foreground">
                                {log.user_full_name || 'System'}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        {/* Edit Delivery Tab */}
        <TabsContent value="edit" className="flex-1 overflow-y-auto pb-24 lg:pb-20 mt-0">
          <div className="p-4 space-y-4">
            {!isAssigned ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                  <h3 className="font-semibold">Cannot Edit Delivery</h3>
                  <p className="text-sm text-muted-foreground">
                    Please assign the order to a driver first.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Current Status */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Current Status</span>
                      <Badge variant={isCompleted ? (order.timeline_status === 'COMPLETED_DELIVERED' ? 'default' : 'destructive') : 'secondary'}>
                        {order.timeline_status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline Editor */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Delivery Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Ordered - Read Only */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <Package className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="w-0.5 h-full bg-border flex-1 mt-2" />
                      </div>
                      <div className="flex-1 pb-6">
                        <h4 className="font-medium">Ordered</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {order.order_date ? new Date(order.order_date).toLocaleDateString() : 'No date'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Read-only</p>
                      </div>
                    </div>

                    {/* Picked Up */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${editPickedUpAt ? 'bg-blue-100' : 'bg-muted'}`}>
                          <CheckCircle className={`h-5 w-5 ${editPickedUpAt ? 'text-blue-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="w-0.5 h-full bg-border flex-1 mt-2" />
                      </div>
                      <div className="flex-1 pb-6">
                        <h4 className="font-medium">Picked Up</h4>
                        <p className="text-xs text-muted-foreground mb-2">When order was assigned to driver</p>
                        <Input
                          type="datetime-local"
                          value={editPickedUpAt}
                          onChange={(e) => setEditPickedUpAt(e.target.value)}
                          className="max-w-xs"
                        />
                      </div>
                    </div>

                    {/* Shipped */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${editShippedAt ? 'bg-purple-100' : 'bg-muted'}`}>
                          <Navigation className={`h-5 w-5 ${editShippedAt ? 'text-purple-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="w-0.5 h-full bg-border flex-1 mt-2" />
                      </div>
                      <div className="flex-1 pb-6">
                        <h4 className="font-medium">Shipped</h4>
                        <p className="text-xs text-muted-foreground mb-2">When driver started transit</p>
                        <Input
                          type="datetime-local"
                          value={editShippedAt}
                          onChange={(e) => setEditShippedAt(e.target.value)}
                          className="max-w-xs"
                        />
                      </div>
                    </div>

                    {/* Delivered */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          editDeliveryStatus 
                            ? deliveryOutcomes.find(o => o.value === editDeliveryStatus)?.success 
                              ? 'bg-green-100' 
                              : 'bg-red-100'
                            : 'bg-muted'
                        }`}>
                          <Truck className={`h-5 w-5 ${
                            editDeliveryStatus 
                              ? deliveryOutcomes.find(o => o.value === editDeliveryStatus)?.success 
                                ? 'text-green-600' 
                                : 'text-red-600'
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">Delivered</h4>
                        <p className="text-xs text-muted-foreground mb-2">Delivery outcome</p>
                        <div className="space-y-3">
                          <Select value={editDeliveryStatus} onValueChange={setEditDeliveryStatus}>
                            <SelectTrigger className="max-w-xs">
                              <SelectValue placeholder="Select outcome" />
                            </SelectTrigger>
                            <SelectContent>
                              {deliveryOutcomes.map((outcome) => (
                                <SelectItem key={outcome.value} value={outcome.value}>
                                  {outcome.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="datetime-local"
                            value={editCompletedAt}
                            onChange={(e) => setEditCompletedAt(e.target.value)}
                            className="max-w-xs"
                            placeholder="Completion time"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Sticky Save Button */}
          {isAssigned && (
            <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 p-4 bg-background border-t">
              <Button className="w-full lg:max-w-md lg:mx-auto lg:block" onClick={handleSaveDelivery} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
