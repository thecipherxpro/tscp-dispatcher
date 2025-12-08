import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileDown, Package, User, Calendar, Clock, MapPin, 
  Phone, Mail, Truck, CheckCircle2, CircleDot, Navigation, 
  Building, AlertTriangle, Shield, Globe, Smartphone,
  UserCheck, Lock
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
  geolocation: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user_role: string | null;
  user_full_name: string | null;
  driver_id: string | null;
  session_id: string | null;
  access_location: string | null;
  consent_verified: boolean | null;
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
      case 'PICKED_UP':
        return { label: 'Picked Up', className: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'SHIPPED':
        return { label: 'Shipped', className: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'DELIVERED':
        return { label: 'Delivered', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'DELIVERY_INCOMPLETE':
        return { label: 'Delivery Incomplete', className: 'bg-red-100 text-red-800 border-red-200' };
      default:
        return { label: status, className: '' };
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'ORDER_IMPORTED':
        return <Package className="w-4 h-4" />;
      case 'ORDER_ASSIGNED':
        return <User className="w-4 h-4" />;
      case 'ORDER_CONFIRMED':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'ORDER_SHIPPED':
        return <Truck className="w-4 h-4" />;
      case 'ORDER_ARRIVED':
        return <MapPin className="w-4 h-4" />;
      case 'REVIEW_REQUESTED':
        return <AlertTriangle className="w-4 h-4" />;
      case 'DELIVERY_COMPLETED_SUCCESS':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'DELIVERY_COMPLETED_INCOMPLETE':
        return <AlertTriangle className="w-4 h-4" />;
      case 'STATUS_CHANGE':
        return <Navigation className="w-4 h-4" />;
      case 'DRIVER_ASSIGNED':
        return <User className="w-4 h-4" />;
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
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Error', description: 'Please allow popups to export PDF', variant: 'destructive' });
      return;
    }

    const clientInitials = order?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'NA';
    const driverInitials = driver?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'DR';

    const styles = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          padding: 24px; 
          color: #1a1a1a; 
          background: #f8fafc;
          line-height: 1.5;
        }
        .container { max-width: 800px; margin: 0 auto; }
        
        /* Header */
        .header { 
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
          border: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-title { font-size: 20px; font-weight: 600; color: #111827; }
        .header-subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
        
        /* Badge */
        .badge { 
          display: inline-block; 
          padding: 4px 10px; 
          border-radius: 9999px; 
          font-size: 11px; 
          font-weight: 500;
        }
        .badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
        .badge-blue { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
        .badge-purple { background: #f3e8ff; color: #7c3aed; border: 1px solid #c4b5fd; }
        .badge-emerald { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
        .badge-red { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .badge-outline { background: white; color: #374151; border: 1px solid #d1d5db; }
        
        /* Card */
        .card { 
          background: white; 
          border-radius: 12px; 
          border: 1px solid #e5e7eb; 
          margin-bottom: 16px;
          overflow: hidden;
        }
        .card-header { 
          padding: 16px 20px 12px; 
          border-bottom: 1px solid #f3f4f6;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .card-icon { 
          width: 16px; 
          height: 16px; 
          color: #6b7280;
        }
        .card-title { 
          font-size: 14px; 
          font-weight: 600; 
          color: #111827;
        }
        .card-content { padding: 16px 20px; }
        
        /* Avatar */
        .avatar { 
          width: 40px; 
          height: 40px; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .avatar-primary { background: #eff6ff; color: #2563eb; }
        .avatar-emerald { background: #d1fae5; color: #059669; }
        
        /* Grid */
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        
        /* Field */
        .field-label { 
          font-size: 10px; 
          text-transform: uppercase; 
          color: #9ca3af; 
          letter-spacing: 0.05em;
          font-weight: 500;
          margin-bottom: 2px;
        }
        .field-value { font-size: 14px; font-weight: 500; color: #111827; }
        .field-value.mono { font-family: ui-monospace, monospace; }
        
        /* Separator */
        .separator { height: 1px; background: #f3f4f6; margin: 12px 0; }
        
        /* Info row */
        .info-row { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          font-size: 13px; 
          color: #374151;
          margin-bottom: 6px;
        }
        .info-icon { width: 16px; height: 16px; color: #9ca3af; }
        
        /* User card */
        .user-card { display: flex; align-items: center; gap: 12px; }
        .user-info { flex: 1; }
        .user-name { font-size: 14px; font-weight: 600; color: #111827; }
        .user-detail { font-size: 12px; color: #6b7280; }
        
        /* Timeline */
        .timeline { position: relative; padding-left: 24px; }
        .timeline::before { 
          content: ''; 
          position: absolute; 
          left: 11px; 
          top: 12px; 
          bottom: 12px; 
          width: 2px; 
          background: #e5e7eb;
        }
        .timeline-item { 
          position: relative; 
          padding-bottom: 16px; 
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .timeline-item:last-child { padding-bottom: 0; }
        .timeline-dot { 
          width: 24px; 
          height: 24px; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          font-size: 12px;
          position: relative;
          z-index: 1;
          margin-left: -12px;
        }
        .timeline-dot-amber { background: #fef3c7; color: #d97706; }
        .timeline-dot-blue { background: #dbeafe; color: #2563eb; }
        .timeline-dot-purple { background: #f3e8ff; color: #7c3aed; }
        .timeline-dot-emerald { background: #d1fae5; color: #059669; }
        .timeline-dot-muted { background: #f3f4f6; color: #9ca3af; }
        .timeline-content { flex: 1; padding-top: 2px; }
        .timeline-title { font-size: 13px; font-weight: 500; color: #111827; }
        .timeline-time { font-size: 11px; color: #6b7280; }
        
        /* Audit log item */
        .audit-item { 
          background: #f9fafb; 
          border-radius: 8px; 
          padding: 12px;
          margin-bottom: 10px;
        }
        .audit-item:last-child { margin-bottom: 0; }
        .audit-header { display: flex; align-items: flex-start; gap: 12px; }
        .audit-icon { 
          width: 32px; 
          height: 32px; 
          border-radius: 50%; 
          background: #eff6ff; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          flex-shrink: 0;
        }
        .audit-content { flex: 1; }
        .audit-action { font-size: 13px; font-weight: 500; color: #111827; }
        .audit-time { font-size: 11px; color: #6b7280; margin-top: 2px; }
        .audit-meta { 
          display: flex; 
          gap: 12px; 
          margin-top: 8px; 
          font-size: 10px; 
          color: #9ca3af;
        }
        .audit-meta-item { display: flex; align-items: center; gap: 4px; }
        
        /* Empty state */
        .empty-state { 
          text-align: center; 
          padding: 24px; 
          color: #9ca3af;
        }
        .empty-icon { font-size: 32px; margin-bottom: 8px; opacity: 0.5; }
        
        /* Footer */
        .footer { 
          margin-top: 24px; 
          padding-top: 16px; 
          border-top: 1px solid #e5e7eb;
          font-size: 10px;
          color: #9ca3af;
          text-align: center;
        }
        
        /* SVG Icons */
        .svg-icon { width: 14px; height: 14px; }
        
        @media print { 
          body { padding: 16px; background: white; }
          .card { break-inside: avoid; }
        }
      </style>
    `;

    // SVG icons as inline strings
    const icons = {
      package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
      building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
      clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
      phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
      mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
      mapPin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
      navigation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
      circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
      smartphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
      globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
      ip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/><path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/><path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z"/><path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/></svg>'
    };

    const getStatusBadgeClass = (status: string) => {
      switch (status) {
        case 'PENDING': return 'badge-amber';
        case 'PICKED_UP': return 'badge-blue';
        case 'SHIPPED': return 'badge-purple';
        case 'DELIVERED': return 'badge-emerald';
        case 'DELIVERY_INCOMPLETE': return 'badge-red';
        default: return 'badge-outline';
      }
    };

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Audit Trail - ${order?.shipment_id || order?.id}</title>
        ${styles}
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div>
              <div class="header-title">Audit Trail</div>
              <div class="header-subtitle">${order?.shipment_id || 'No Shipment ID'}</div>
            </div>
            <div style="text-align: right;">
              <span class="badge ${getStatusBadgeClass(order?.timeline_status || 'PENDING')}">${statusConfig.label}</span>
              ${order?.delivery_status ? `<span class="badge badge-emerald" style="margin-left: 8px;">${order.delivery_status.replace(/_/g, ' ')}</span>` : ''}
            </div>
          </div>

          <!-- Order Summary Card -->
          <div class="card">
            <div class="card-header">
              <span class="card-icon">${icons.package}</span>
              <span class="card-title">Order Summary</span>
            </div>
            <div class="card-content">
              <div class="grid-2">
                <div>
                  <div class="field-label">Shipment ID</div>
                  <div class="field-value mono">${order?.shipment_id || 'Not assigned'}</div>
                </div>
                <div>
                  <div class="field-label">Tracking ID</div>
                  <div class="field-value mono">${order?.tracking_id || 'Not assigned'}</div>
                </div>
                <div>
                  <div class="field-label">Shipped Date</div>
                  <div class="field-value">${order?.shipped_at ? formatDateTime(order.shipped_at) : 'Not shipped'}</div>
                </div>
                <div>
                  <div class="field-label">Billing Date</div>
                  <div class="field-value">${formatDate(order?.billing_date || null)}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Client Information Card -->
          <div class="card">
            <div class="card-header">
              <span class="card-icon">${icons.user}</span>
              <span class="card-title">Client Information</span>
            </div>
            <div class="card-content">
              <div class="user-card">
                <div class="avatar avatar-primary">${clientInitials}</div>
                <div class="user-info">
                  <div class="user-name">${order?.name || 'No name'}</div>
                  <div class="user-detail">DOB: ${formatDate(order?.dob || null)}</div>
                </div>
              </div>
              <div class="separator"></div>
              <div class="info-row">
                <span class="info-icon">${icons.phone}</span>
                ${order?.phone_number || 'No phone'}
              </div>
              <div class="info-row">
                <span class="info-icon">${icons.mail}</span>
                ${order?.email || 'No email'}
              </div>
              <div class="info-row">
                <span class="info-icon">${icons.mapPin}</span>
                ${[order?.address_1, order?.city, order?.province, order?.postal].filter(Boolean).join(', ') || 'No address'}
              </div>
            </div>
          </div>

          <!-- Pharmacy Details Card -->
          <div class="card">
            <div class="card-header">
              <span class="card-icon">${icons.building}</span>
              <span class="card-title">Pharmacy Details</span>
            </div>
            <div class="card-content">
              <div class="grid-2">
                <div>
                  <div class="field-label">Pharmacy Name</div>
                  <div class="field-value">${order?.pharmacy_name || 'Not provided'}</div>
                </div>
                <div>
                  <div class="field-label">Authorizing Pharmacist</div>
                  <div class="field-value">${order?.authorizing_pharmacist || 'Not provided'}</div>
                </div>
              </div>
              <div class="separator"></div>
              <div class="grid-2">
                <div>
                  <div class="field-label">Nasal RX</div>
                  <div class="field-value mono">${order?.nasal_rx || '—'}</div>
                </div>
                <div>
                  <div class="field-label">Injection RX</div>
                  <div class="field-value mono">${order?.injection_rx || '—'}</div>
                </div>
                <div>
                  <div class="field-label">Doses Nasal</div>
                  <div class="field-value">${order?.doses_nasal ?? '—'}</div>
                </div>
                <div>
                  <div class="field-label">Doses Injectable</div>
                  <div class="field-value">${order?.doses_injectable ?? '—'}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Driver Assignment Card -->
          <div class="card">
            <div class="card-header">
              <span class="card-icon">${icons.truck}</span>
              <span class="card-title">Driver Assignment</span>
            </div>
            <div class="card-content">
              ${driver ? `
                <div class="user-card">
                  <div class="avatar avatar-emerald">${driverInitials}</div>
                  <div class="user-info">
                    <div class="user-name">${driver.full_name || 'Unknown Driver'}</div>
                    <div class="user-detail">${driver.phone || 'No phone'}</div>
                  </div>
                </div>
                <div class="separator"></div>
                <div class="grid-2">
                  <div>
                    <div class="field-label">Assigned At</div>
                    <div class="field-value">${formatDateTime(order?.confirmed_at || null) || 'Unknown'}</div>
                  </div>
                  <div>
                    <div class="field-label">Onboarding</div>
                    <span class="badge badge-outline">${driver.onboarding_status?.replace('_', ' ') || 'Unknown'}</span>
                  </div>
                </div>
              ` : `
                <div class="empty-state">
                  <div class="empty-icon">${icons.user}</div>
                  <div>No driver assigned yet</div>
                </div>
              `}
            </div>
          </div>

          <!-- Delivery Timeline Card -->
          <div class="card">
            <div class="card-header">
              <span class="card-icon">${icons.clock}</span>
              <span class="card-title">Delivery Timeline</span>
            </div>
            <div class="card-content">
              <div class="timeline">
                <div class="timeline-item">
                  <div class="timeline-dot ${order?.pending_at ? 'timeline-dot-amber' : 'timeline-dot-muted'}">${icons.circle}</div>
                  <div class="timeline-content">
                    <div class="timeline-title">Pending</div>
                    <div class="timeline-time">${order?.pending_at ? formatDateTime(order.pending_at) : 'Awaiting processing'}</div>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-dot ${order?.confirmed_at ? 'timeline-dot-blue' : 'timeline-dot-muted'}">${icons.check}</div>
                  <div class="timeline-content">
                    <div class="timeline-title">Confirmed</div>
                    <div class="timeline-time">${order?.confirmed_at ? formatDateTime(order.confirmed_at) : 'Not yet assigned'}</div>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-dot ${order?.in_route_at ? 'timeline-dot-purple' : 'timeline-dot-muted'}">${icons.navigation}</div>
                  <div class="timeline-content">
                    <div class="timeline-title">In Route</div>
                    <div class="timeline-time">${order?.in_route_at ? formatDateTime(order.in_route_at) : 'Driver not started'}</div>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-dot ${order?.completed_at ? 'timeline-dot-emerald' : 'timeline-dot-muted'}">${icons.truck}</div>
                  <div class="timeline-content">
                    <div class="timeline-title">Delivered</div>
                    <div class="timeline-time">${order?.completed_at ? formatDateTime(order.completed_at) : 'Awaiting delivery'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PHIPA Compliance Notice -->
          <div class="card" style="border-color: #3b82f6; background: #eff6ff;">
            <div class="card-header">
              <span class="card-icon">${icons.shield}</span>
              <span class="card-title">PHIPA Compliance</span>
            </div>
            <div class="card-content">
              <p style="font-size: 11px; color: #6b7280; margin: 0;">
                This audit log complies with Ontario's Personal Health Information Protection Act (PHIPA) s. 10.1 
                requirements for electronic audit logs. All access to personal health information (PHI) is logged 
                with the type of PHI accessed, identity of accessor, date/time, and purpose of access.
              </p>
            </div>
          </div>

          <!-- Audit Log Card -->
          <div class="card">
            <div class="card-header">
              <span class="card-icon">${icons.shield}</span>
              <span class="card-title">PHIPA Audit Log</span>
            </div>
            <div class="card-content">
              ${auditLogs.length === 0 ? `
                <div class="empty-state">
                  <div class="empty-icon">${icons.shield}</div>
                  <div>No audit logs recorded yet</div>
                  <div style="font-size: 11px; margin-top: 4px;">Activity will be logged as the order progresses</div>
                </div>
              ` : auditLogs.map(log => {
                const deviceInfo = parseUserAgent(log.user_agent);
                return `
                  <div class="audit-item" style="margin-bottom: 16px; padding: 16px;">
                    <div class="audit-header">
                      <div class="audit-icon">${icons.navigation}</div>
                      <div class="audit-content">
                        <div class="audit-action">
                          ${log.action.replace(/_/g, ' ')}
                          ${log.previous_status && log.new_status ? `<span class="badge badge-outline" style="margin-left: 8px; font-size: 10px;">${log.previous_status} → ${log.new_status}</span>` : ''}
                        </div>
                        <div class="audit-time">${formatDateTime(log.created_at)}</div>
                      </div>
                    </div>
                    
                    <!-- Audit Fields -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                      <div>
                        <div class="field-label" style="display: flex; align-items: center; gap: 4px;">
                          ${icons.user}
                          Accessed By
                        </div>
                        <div class="field-value">${log.user_full_name || 'Unknown User'}${log.driver_id ? ` (${log.driver_id})` : ''}</div>
                        <div style="font-size: 10px; color: #9ca3af; text-transform: capitalize;">${log.user_role?.replace('_', ' ') || 'Unknown Role'}</div>
                      </div>
                      <div>
                        <div class="field-label">IP Address</div>
                        <div class="field-value">${log.ip_address || 'Not recorded'}</div>
                      </div>
                      <div>
                        <div class="field-label">Device Type</div>
                        <div class="field-value">${deviceInfo.device}</div>
                      </div>
                      <div>
                        <div class="field-label">Browser</div>
                        <div class="field-value">${deviceInfo.browser} / ${deviceInfo.os}</div>
                      </div>
                      <div style="grid-column: span 2;">
                        <div class="field-label">Location</div>
                        <div class="field-value">${log.access_location || 'Not recorded'}${log.geolocation ? ` (${log.geolocation})` : ''}</div>
                      </div>
                    </div>

                    <div class="audit-meta" style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                      ${log.session_id ? `
                        <span class="audit-meta-item">
                          <span class="svg-icon">${icons.shield}</span>
                          Session: ${log.session_id.slice(0, 12)}...
                        </span>
                      ` : ''}
                      ${log.consent_verified ? `
                        <span class="audit-meta-item" style="color: #059669;">
                          <span class="svg-icon">${icons.check}</span>
                          Consent Verified
                        </span>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>Generated: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })} EST</p>
            <p>TSCP Delivery Dispatch System • PHIPA Compliant Audit Report • All timestamps in Eastern Time</p>
          </div>
          </div>
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
            <Button variant="ghost" size="icon" onClick={() => navigate(`/tracking/${orderId}`)}>
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
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Shipped Date</p>
                  <p className="text-sm font-medium">{order.shipped_at ? formatDateTime(order.shipped_at) : 'Not shipped'}</p>
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

          {/* Pharmacy Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="w-4 h-4" />
                Pharmacy Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Pharmacy Name</p>
                  <p className="text-sm font-semibold">{order.pharmacy_name || <EmptyField label="Not provided" />}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Authorizing Pharmacist</p>
                  <p className="text-sm font-semibold">{order.authorizing_pharmacist || <EmptyField label="Not provided" />}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Nasal RX</p>
                  <p className="text-sm font-mono">{order.nasal_rx || <EmptyField label="—" />}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Injection RX</p>
                  <p className="text-sm font-mono">{order.injection_rx || <EmptyField label="—" />}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Doses Nasal</p>
                  <p className="text-sm font-semibold">{order.doses_nasal ?? <EmptyField label="—" />}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Doses Injectable</p>
                  <p className="text-sm font-semibold">{order.doses_injectable ?? <EmptyField label="—" />}</p>
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

          {/* PHIPA Compliance Notice */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                PHIPA Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                This audit log complies with Ontario's Personal Health Information Protection Act (PHIPA) s. 10.1 
                requirements for electronic audit logs. All access to personal health information (PHI) is logged 
                with the type of PHI accessed, identity of accessor, date/time, and purpose of access.
              </p>
            </CardContent>
          </Card>

          {/* Audit Log Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                PHIPA Audit Log
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
                <div className="space-y-4">
                  {auditLogs.map((log) => {
                    const deviceInfo = parseUserAgent(log.user_agent);
                    return (
                      <div key={log.id} className="bg-muted/30 rounded-lg p-4 space-y-3">
                        {/* Header Row */}
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
                          </div>
                        </div>

                        {/* Audit Details */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                          {/* Accessed By with Driver ID */}
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                              <UserCheck className="w-3 h-3" />
                              Accessed By
                            </p>
                            <p className="text-xs font-medium">
                              {log.user_full_name || 'Unknown User'}
                              {log.driver_id && <span className="text-primary ml-1">({log.driver_id})</span>}
                            </p>
                            <p className="text-[10px] text-muted-foreground capitalize">{log.user_role?.replace('_', ' ') || 'Unknown Role'}</p>
                          </div>

                          {/* IP Address */}
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              IP Address
                            </p>
                            <p className="text-xs font-medium">{log.ip_address || 'Not recorded'}</p>
                          </div>

                          {/* Device Type */}
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                              <Smartphone className="w-3 h-3" />
                              Device Type
                            </p>
                            <p className="text-xs font-medium">{deviceInfo.device}</p>
                          </div>

                          {/* Browser Type */}
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              Browser
                            </p>
                            <p className="text-xs font-medium">{deviceInfo.browser} / {deviceInfo.os}</p>
                          </div>

                          {/* Location */}
                          <div className="col-span-2">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              Location
                            </p>
                            <p className="text-xs font-medium">
                              {log.access_location || 'Not recorded'}
                              {log.geolocation && (
                                <span className="text-muted-foreground ml-1">({log.geolocation})</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Session & Consent Details */}
                        <div className="pt-2 border-t border-border/50">
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                            {log.session_id && (
                              <div className="flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Session: {log.session_id.slice(0, 12)}...
                              </div>
                            )}
                            {log.consent_verified && (
                              <div className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="w-3 h-3" />
                                Consent Verified
                              </div>
                            )}
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