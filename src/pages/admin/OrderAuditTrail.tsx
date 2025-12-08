import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileDown, Package, User, Calendar, Clock, MapPin, 
  Phone, Mail, Truck, CheckCircle2, CircleDot, Navigation, 
  Building, AlertTriangle, Shield, Globe, Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Order, Profile } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';

interface AuditLog {
  id: string;
  order_id: string;
  user_id: string | null;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  delivery_status: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Empty state component
const EmptyField = ({ label }: { label?: string }) => (
  <span className="text-muted-foreground/60 italic text-sm">{label || 'Not provided'}</span>
);

export default function OrderAuditTrail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [order, setOrder] = useState<Order | null>(null);
  const [driver, setDriver] = useState<Profile | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orderId) return;
    
    setIsLoading(true);
    
    try {
      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (orderData) {
        setOrder(orderData as Order);
        
        // Fetch driver if assigned
        if (orderData.assigned_driver_id) {
          const { data: driverProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', orderData.assigned_driver_id)
            .maybeSingle();
          
          if (driverProfile) {
            setDriver(driverProfile as Profile);
          }
        }
      }

      // Fetch audit logs
      const { data: logsData, error: logsError } = await supabase
        .from('order_audit_logs')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (logsError) throw logsError;
      setAuditLogs((logsData as AuditLog[]) || []);

    } catch (err) {
      console.error('Error fetching data:', err);
      toast({ title: 'Error', description: 'Failed to load audit trail', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'CONFIRMED':
        return { label: 'Confirmed', className: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'IN_ROUTE':
        return { label: 'In Route', className: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'ARRIVED':
        return { label: 'Arrived', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'COMPLETED':
        return { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'REQUEST_ADDRESS_REVIEW':
        return { label: 'Address Review', className: 'bg-red-100 text-red-800 border-red-200' };
      default:
        return { label: status, className: '' };
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'STATUS_CHANGE':
        return <Navigation className="w-4 h-4" />;
      case 'DRIVER_ASSIGNED':
        return <User className="w-4 h-4" />;
      case 'ORDER_CREATED':
        return <Package className="w-4 h-4" />;
      case 'DELIVERY_COMPLETED':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <CircleDot className="w-4 h-4" />;
    }
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
    
    let browser = 'Unknown';
    let os = 'Unknown';
    let device = 'Desktop';

    // Browser detection
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    // OS detection
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    // Device detection
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
      device = 'Mobile';
    } else if (ua.includes('Tablet') || ua.includes('iPad')) {
      device = 'Tablet';
    }

    return { browser, os, device };
  };

  const handleExportPDF = () => {
    // Create a printable version
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Error', description: 'Please allow popups to export PDF', variant: 'destructive' });
      return;
    }

    const styles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        h2 { font-size: 18px; margin: 24px 0 12px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px; }
        h3 { font-size: 14px; margin: 16px 0 8px; color: #666; }
        .header { border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px; }
        .section { margin-bottom: 24px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field { margin-bottom: 8px; }
        .label { font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 2px; }
        .value { font-size: 14px; font-weight: 500; }
        .timeline-item { display: flex; gap: 12px; margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 8px; }
        .timeline-dot { width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-info { background: #dbeafe; color: #1e40af; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 12px; }
        th { background: #f5f5f5; font-weight: 600; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #666; }
        @media print { body { padding: 20px; } }
      </style>
    `;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order Audit Trail - ${order?.shipment_id || order?.id}</title>
        ${styles}
      </head>
      <body>
        <div class="header">
          <h1>Order Audit Trail</h1>
          <p>Shipment ID: <strong>${order?.shipment_id || 'Not assigned'}</strong></p>
          <p>Tracking ID: <strong>${order?.tracking_id || 'Not assigned'}</strong></p>
          <p>Generated: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}</p>
        </div>

        <div class="section">
          <h2>Order Information</h2>
          <div class="grid">
            <div class="field">
              <div class="label">Current Status</div>
              <div class="value"><span class="badge badge-info">${order?.timeline_status?.replace('_', ' ') || 'Unknown'}</span></div>
            </div>
            <div class="field">
              <div class="label">Delivery Status</div>
              <div class="value">${order?.delivery_status?.replace(/_/g, ' ') || 'Pending'}</div>
            </div>
            <div class="field">
              <div class="label">Ship Date</div>
              <div class="value">${formatDate(order?.ship_date || null)}</div>
            </div>
            <div class="field">
              <div class="label">Billing Date</div>
              <div class="value">${formatDate(order?.billing_date || null)}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Client Information</h2>
          <div class="grid">
            <div class="field">
              <div class="label">Name</div>
              <div class="value">${order?.name || 'Not provided'}</div>
            </div>
            <div class="field">
              <div class="label">Date of Birth</div>
              <div class="value">${formatDate(order?.dob || null)}</div>
            </div>
            <div class="field">
              <div class="label">Phone</div>
              <div class="value">${order?.phone_number || 'Not provided'}</div>
            </div>
            <div class="field">
              <div class="label">Email</div>
              <div class="value">${order?.email || 'Not provided'}</div>
            </div>
          </div>
          <h3>Delivery Address</h3>
          <div class="value">${[order?.address_1, order?.address_2, order?.city, order?.province, order?.postal, order?.country].filter(Boolean).join(', ') || 'Not provided'}</div>
        </div>

        <div class="section">
          <h2>Driver Assignment</h2>
          <div class="grid">
            <div class="field">
              <div class="label">Driver Name</div>
              <div class="value">${driver?.full_name || 'Not assigned'}</div>
            </div>
            <div class="field">
              <div class="label">Driver Phone</div>
              <div class="value">${driver?.phone || 'Not provided'}</div>
            </div>
            <div class="field">
              <div class="label">Assigned At</div>
              <div class="value">${formatDateTime(order?.confirmed_at || null) || 'Not assigned'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Delivery Timeline</h2>
          ${order?.pending_at ? `<div class="timeline-item"><div class="timeline-dot">1</div><div><strong>Pending</strong><br/>${formatDateTime(order.pending_at)}</div></div>` : ''}
          ${order?.confirmed_at ? `<div class="timeline-item"><div class="timeline-dot">2</div><div><strong>Confirmed</strong><br/>${formatDateTime(order.confirmed_at)}</div></div>` : ''}
          ${order?.in_route_at ? `<div class="timeline-item"><div class="timeline-dot">3</div><div><strong>In Route</strong><br/>${formatDateTime(order.in_route_at)}</div></div>` : ''}
          ${order?.arrived_at ? `<div class="timeline-item"><div class="timeline-dot">4</div><div><strong>Arrived</strong><br/>${formatDateTime(order.arrived_at)}</div></div>` : ''}
          ${order?.completed_at ? `<div class="timeline-item"><div class="timeline-dot">5</div><div><strong>Completed</strong><br/>${formatDateTime(order.completed_at)}${order.delivery_status ? `<br/><span class="badge badge-success">${order.delivery_status.replace(/_/g, ' ')}</span>` : ''}</div></div>` : ''}
        </div>

        <div class="section">
          <h2>Audit Log</h2>
          <table>
            <thead>
              <tr>
                <th>Timestamp (EST)</th>
                <th>Action</th>
                <th>Status Change</th>
                <th>Device Info</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${auditLogs.map(log => {
                const deviceInfo = parseUserAgent(log.user_agent);
                return `
                  <tr>
                    <td>${formatDateTime(log.created_at)}</td>
                    <td>${log.action.replace(/_/g, ' ')}</td>
                    <td>${log.previous_status ? `${log.previous_status} → ${log.new_status}` : log.new_status || '-'}</td>
                    <td>${deviceInfo.browser} / ${deviceInfo.os} (${deviceInfo.device})</td>
                    <td>${log.ip_address || 'Not captured'}</td>
                  </tr>
                `;
              }).join('')}
              ${auditLogs.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #666;">No audit logs recorded yet</td></tr>' : ''}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>This document was generated automatically by TSCP Delivery Dispatch System.</p>
          <p>All timestamps are in Eastern Standard Time (EST/EDT).</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground mt-3">Loading audit trail...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center">
          <p className="text-destructive">Order not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(order.timeline_status || 'PENDING');

  return (
    <div className="min-h-screen bg-background" ref={printRef}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Audit Trail</h1>
              <p className="text-xs text-muted-foreground">{order.shipment_id || 'No Shipment ID'}</p>
            </div>
          </div>
          <Button onClick={handleExportPDF} size="sm" variant="outline">
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="px-4 pb-24">
        <div className="py-4 space-y-5">
          
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
            {order.delivery_status && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                {order.delivery_status.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>

          {/* Order Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Shipment ID</p>
                  <p className="text-sm font-mono font-semibold">{order.shipment_id || <EmptyField label="Not assigned" />}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Tracking ID</p>
                  <p className="text-sm font-mono font-semibold">{order.tracking_id || <EmptyField label="Not assigned" />}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Ship Date</p>
                  <p className="text-sm font-medium">{formatDate(order.ship_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Billing Date</p>
                  <p className="text-sm font-medium">{formatDate(order.billing_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Information Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {order.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'NA'}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-foreground">{order.name || <EmptyField label="No name" />}</p>
                  <p className="text-xs text-muted-foreground">DOB: {formatDate(order.dob)}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {order.phone_number || <EmptyField label="No phone" />}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {order.email || <EmptyField label="No email" />}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {[order.address_1, order.city, order.province, order.postal].filter(Boolean).join(', ') || <EmptyField label="No address" />}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Driver Assignment Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Driver Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {driver ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-emerald-700">
                        {driver.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'DR'}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{driver.full_name || 'Unknown Driver'}</p>
                      <p className="text-xs text-muted-foreground">{driver.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Assigned At</p>
                      <p className="text-sm font-medium">{formatDateTime(order.confirmed_at) || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Onboarding</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {driver.onboarding_status?.replace('_', ' ') || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <User className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No driver assigned yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Delivery Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border" />
                
                {/* Pending */}
                <div className="relative flex items-start gap-3 pb-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                    order.pending_at ? 'bg-amber-100 text-amber-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    <CircleDot className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-medium text-foreground">Pending</p>
                    <p className="text-xs text-muted-foreground">
                      {order.pending_at ? formatDateTime(order.pending_at) : 'Awaiting processing'}
                    </p>
                  </div>
                </div>
                
                {/* Confirmed */}
                <div className="relative flex items-start gap-3 pb-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                    order.confirmed_at ? 'bg-blue-100 text-blue-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-medium text-foreground">Confirmed</p>
                    <p className="text-xs text-muted-foreground">
                      {order.confirmed_at ? formatDateTime(order.confirmed_at) : 'Not yet assigned'}
                    </p>
                  </div>
                </div>
                
                {/* In Route */}
                <div className="relative flex items-start gap-3 pb-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                    order.in_route_at ? 'bg-purple-100 text-purple-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Navigation className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-medium text-foreground">In Route</p>
                    <p className="text-xs text-muted-foreground">
                      {order.in_route_at ? formatDateTime(order.in_route_at) : 'Driver not started'}
                    </p>
                  </div>
                </div>
                
                {/* Delivered */}
                <div className="relative flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                    order.completed_at ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-medium text-foreground">Delivered</p>
                    {order.completed_at ? (
                      <p className="text-xs text-muted-foreground">{formatDateTime(order.completed_at)}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Awaiting delivery</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Log Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="text-center py-6">
                  <Shield className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No audit logs recorded yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Activity will be logged as the order progresses
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => {
                    const deviceInfo = parseUserAgent(log.user_agent);
                    return (
                      <div key={log.id} className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {getActionIcon(log.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground">
                                {log.action.replace(/_/g, ' ')}
                              </p>
                              {log.previous_status && log.new_status && (
                                <Badge variant="outline" className="text-[10px]">
                                  {log.previous_status} → {log.new_status}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDateTime(log.created_at)}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Smartphone className="w-3 h-3" />
                                {deviceInfo.device}
                              </div>
                              <div className="flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {deviceInfo.browser} / {deviceInfo.os}
                              </div>
                              {log.ip_address && (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {log.ip_address}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}