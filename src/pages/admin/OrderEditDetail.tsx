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
  Mail,
  Syringe,
  Wind,
  Pill,
  FileDown,
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
      // Check if orderId is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUUID = uuidRegex.test(orderId);

      // Build the query based on what type of ID we have
      let query = supabase.from('orders').select('*');
      
      if (isUUID) {
        // If it's a UUID, check all three fields
        query = query.or(`shipment_id.eq.${orderId},tracking_id.eq.${orderId},id.eq.${orderId}`);
      } else {
        // If not a UUID, only check shipment_id and tracking_id
        query = query.or(`shipment_id.eq.${orderId},tracking_id.eq.${orderId}`);
      }

      const { data, error } = await query.maybeSingle();

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

  const handleExportAuditPDF = () => {
    if (!order) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to export PDF');
      return;
    }

    const clientInitials = order.client_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'NA';
    const driverInitials = driver?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'DR';

    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'PENDING': return 'Pending';
        case 'PICKED_UP_AND_ASSIGNED': return 'Assigned';
        case 'REVIEW_REQUESTED': return 'Review Requested';
        case 'CONFIRMED': return 'Confirmed';
        case 'IN_ROUTE': return 'In Route';
        case 'COMPLETED_DELIVERED': return 'Delivered';
        case 'COMPLETED_INCOMPLETE': return 'Incomplete';
        default: return status;
      }
    };

    const getStatusBadgeClass = (status: string) => {
      switch (status) {
        case 'PENDING': return 'badge-amber';
        case 'PICKED_UP_AND_ASSIGNED': return 'badge-blue';
        case 'REVIEW_REQUESTED': return 'badge-amber';
        case 'CONFIRMED': return 'badge-indigo';
        case 'IN_ROUTE': return 'badge-purple';
        case 'COMPLETED_DELIVERED': return 'badge-emerald';
        case 'COMPLETED_INCOMPLETE': return 'badge-red';
        default: return 'badge-outline';
      }
    };

    const styles = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1a1a1a; background: #f8fafc; line-height: 1.5; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .header-title { font-size: 20px; font-weight: 600; color: #111827; }
        .header-subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 500; }
        .badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
        .badge-blue { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
        .badge-indigo { background: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc; }
        .badge-purple { background: #f3e8ff; color: #7c3aed; border: 1px solid #c4b5fd; }
        .badge-emerald { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
        .badge-red { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .badge-outline { background: white; color: #374151; border: 1px solid #d1d5db; }
        .card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; margin-bottom: 16px; overflow: hidden; }
        .card-header { padding: 16px 20px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; font-weight: 600; color: #111827; }
        .card-content { padding: 16px 20px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field-label { font-size: 10px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; font-weight: 500; margin-bottom: 2px; }
        .field-value { font-size: 14px; font-weight: 500; color: #111827; }
        .field-value.mono { font-family: ui-monospace, monospace; }
        .separator { height: 1px; background: #f3f4f6; margin: 12px 0; }
        .drug-section { background: #f9fafb; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
        .drug-section:last-child { margin-bottom: 0; }
        .drug-title { font-size: 11px; font-weight: 600; color: #2563eb; margin-bottom: 8px; }
        .audit-item { background: #f9fafb; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
        .audit-item:last-child { margin-bottom: 0; }
        .audit-action { font-size: 13px; font-weight: 500; color: #111827; }
        .audit-time { font-size: 11px; color: #6b7280; margin-top: 2px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0; }
        .avatar-primary { background: #eff6ff; color: #2563eb; }
        .avatar-emerald { background: #d1fae5; color: #059669; }
        .user-card { display: flex; align-items: center; gap: 12px; }
        .user-name { font-size: 14px; font-weight: 600; color: #111827; }
        .user-detail { font-size: 12px; color: #6b7280; }
        .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
        /* Timeline Styles */
        .timeline { position: relative; padding-left: 36px; }
        .timeline::before { content: ''; position: absolute; left: 12px; top: 24px; bottom: 24px; width: 2px; background: #e5e7eb; }
        .timeline-item { position: relative; padding-bottom: 16px; display: flex; align-items: flex-start; gap: 12px; }
        .timeline-item:last-child { padding-bottom: 0; }
        .timeline-dot { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: absolute; left: -36px; z-index: 1; }
        .timeline-dot svg { width: 14px; height: 14px; }
        .timeline-dot-amber { background: #fef3c7; color: #d97706; }
        .timeline-dot-blue { background: #dbeafe; color: #2563eb; }
        .timeline-dot-indigo { background: #e0e7ff; color: #4f46e5; }
        .timeline-dot-purple { background: #f3e8ff; color: #7c3aed; }
        .timeline-dot-emerald { background: #d1fae5; color: #059669; }
        .timeline-dot-red { background: #fee2e2; color: #dc2626; }
        .timeline-dot-muted { background: #f3f4f6; color: #9ca3af; }
        .timeline-content { flex: 1; padding-top: 2px; }
        .timeline-title { font-size: 13px; font-weight: 500; color: #111827; }
        .timeline-time { font-size: 11px; color: #6b7280; }
        .timeline-meta { font-size: 10px; color: #2563eb; margin-top: 2px; }
        @media print { body { padding: 16px; background: white; } .card { break-inside: avoid; } }
      </style>
    `;

    // SVG icons for timeline
    const icons = {
      circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
      package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
      navigation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
      truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
    };

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Audit Trail - ${order.shipment_id || order.id}</title>
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <div class="header-title">Audit Trail</div>
              <div class="header-subtitle">${order.shipment_id || 'No Shipment ID'}</div>
            </div>
            <div style="text-align: right;">
              <span class="badge ${getStatusBadgeClass(order.timeline_status || 'PENDING')}">${getStatusLabel(order.timeline_status || 'PENDING')}</span>
              ${order.delivery_status ? `<span class="badge badge-emerald" style="margin-left: 8px;">${order.delivery_status.replace(/_/g, ' ')}</span>` : ''}
            </div>
          </div>

          <div class="card">
            <div class="card-header">Order Summary</div>
            <div class="card-content">
              <div class="grid-2">
                <div>
                  <div class="field-label">Order Date</div>
                  <div class="field-value">${formatDate(order.order_date || null)}</div>
                </div>
                <div>
                  <div class="field-label">Shipment ID</div>
                  <div class="field-value mono">${order.shipment_id || 'Not assigned'}</div>
                </div>
                <div>
                  <div class="field-label">Tracking ID</div>
                  <div class="field-value mono">${order.tracking_id || 'Not assigned'}</div>
                </div>
                <div>
                  <div class="field-label">Shipped Date</div>
                  <div class="field-value">${order.shipped_at ? formatDateTime(order.shipped_at) : 'Not shipped'}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">Customer Information</div>
            <div class="card-content">
              <div class="user-card">
                <div class="avatar avatar-primary">${clientInitials}</div>
                <div>
                  <div class="user-name">${order.client_name || 'No name'}</div>
                  <div class="user-detail">Health Card: ${order.health_card_no || 'N/A'}</div>
                </div>
              </div>
              <div class="separator"></div>
              <div class="grid-2">
                <div>
                  <div class="field-label">Email</div>
                  <div class="field-value">${order.email || 'Not provided'}</div>
                </div>
                <div>
                  <div class="field-label">Address</div>
                  <div class="field-value">${order.address_line_1 || 'No address'}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">Drug Information</div>
            <div class="card-content">
              ${order.authorizing_doctor_name ? `
              <div style="margin-bottom: 12px;">
                <div class="field-label">Authorizing Doctor</div>
                <div class="field-value">${order.authorizing_doctor_name}</div>
              </div>
              <div class="separator"></div>
              ` : ''}
              ${order.nasal_rx_number || order.nasal_qty ? `
              <div class="drug-section">
                <div class="drug-title">Nasal Spray</div>
                <div class="grid-2">
                  <div><div class="field-label">Drug Name</div><div class="field-value">${order.nasal_drug_name || '—'}</div></div>
                  <div><div class="field-label">Qty</div><div class="field-value">${order.nasal_qty ?? '—'}</div></div>
                  <div><div class="field-label">RX#</div><div class="field-value mono">${order.nasal_rx_number || '—'}</div></div>
                  <div><div class="field-label">DIN</div><div class="field-value mono">${order.nasal_din || '—'}</div></div>
                </div>
              </div>
              ` : ''}
              ${order.injection_rx_number || order.injection_qty ? `
              <div class="drug-section">
                <div class="drug-title">Injectable</div>
                <div class="grid-2">
                  <div><div class="field-label">Drug Name</div><div class="field-value">${order.injection_drug_name || '—'}</div></div>
                  <div><div class="field-label">Qty</div><div class="field-value">${order.injection_qty ?? '—'}</div></div>
                  <div><div class="field-label">RX#</div><div class="field-value mono">${order.injection_rx_number || '—'}</div></div>
                  <div><div class="field-label">DIN</div><div class="field-value mono">${order.injection_din || '—'}</div></div>
                  <div><div class="field-label">Strength</div><div class="field-value">${order.injection_strength || '—'}</div></div>
                  <div><div class="field-label">Form</div><div class="field-value">${order.injection_form || '—'}</div></div>
                </div>
              </div>
              ` : ''}
              ${!order.nasal_rx_number && !order.nasal_qty && !order.injection_rx_number && !order.injection_qty ? `
              <div style="text-align: center; padding: 12px; color: #9ca3af;">No drug information available</div>
              ` : ''}
            </div>
          </div>

          ${driver ? `
          <div class="card">
            <div class="card-header">Driver Assignment</div>
            <div class="card-content">
              <div class="user-card">
                <div class="avatar avatar-emerald">${driverInitials}</div>
                <div>
                  <div class="user-name">${driver.full_name || 'Unknown Driver'}</div>
                  <div class="user-detail">${driver.driver_id || 'No Driver ID'} • ${driver.phone || 'No phone'}</div>
                </div>
              </div>
            </div>
          </div>
          ` : ''}

          <div class="card">
            <div class="card-header">Delivery Timeline</div>
            <div class="card-content">
              <div class="timeline">
                <div class="timeline-item">
                  <div class="timeline-dot ${order.pending_at ? 'timeline-dot-amber' : 'timeline-dot-muted'}">${icons.circle}</div>
                  <div class="timeline-content">
                    <div class="timeline-title">Pending</div>
                    <div class="timeline-time">${order.pending_at ? formatDateTime(order.pending_at) : 'Awaiting processing'}</div>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-dot ${order.picked_up_at ? 'timeline-dot-blue' : 'timeline-dot-muted'}">${icons.package}</div>
                  <div class="timeline-content">
                    <div class="timeline-title">Picked Up & Assigned</div>
                    <div class="timeline-time">${order.picked_up_at ? formatDateTime(order.picked_up_at) : 'Not yet picked up'}</div>
                    ${order.picked_up_at && driver ? `<div class="timeline-meta">Assigned to: ${driver.full_name} (${driver.driver_id})</div>` : ''}
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-dot ${order.confirmed_at ? 'timeline-dot-indigo' : 'timeline-dot-muted'}">${icons.check}</div>
                  <div class="timeline-content">
                    <div class="timeline-title">Confirmed</div>
                    <div class="timeline-time">${order.confirmed_at ? formatDateTime(order.confirmed_at) : 'Awaiting confirmation'}</div>
                    ${order.confirmed_at && driver ? `<div class="timeline-meta">Confirmed by: ${driver.driver_id}</div>` : ''}
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-dot ${order.shipped_at || order.in_route_at ? 'timeline-dot-purple' : 'timeline-dot-muted'}">${icons.navigation}</div>
                  <div class="timeline-content">
                    <div class="timeline-title">In Route</div>
                    <div class="timeline-time">${order.shipped_at || order.in_route_at ? formatDateTime(order.shipped_at || order.in_route_at) : 'Not in route yet'}</div>
                    ${(order.shipped_at || order.in_route_at) && driver ? `<div class="timeline-meta">In route by: ${driver.driver_id}</div>` : ''}
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-dot ${order.completed_at ? (order.timeline_status === 'COMPLETED_DELIVERED' ? 'timeline-dot-emerald' : 'timeline-dot-red') : 'timeline-dot-muted'}">${icons.truck}</div>
                  <div class="timeline-content">
                    <div class="timeline-title">${order.timeline_status === 'COMPLETED_INCOMPLETE' ? 'Delivery Incomplete' : 'Delivered'}</div>
                    <div class="timeline-time">${order.completed_at ? formatDateTime(order.completed_at) : 'Awaiting delivery'}</div>
                    ${order.delivery_status ? `<span class="badge ${order.timeline_status === 'COMPLETED_DELIVERED' ? 'badge-emerald' : 'badge-red'}" style="margin-top: 4px; display: inline-block;">${order.delivery_status.replace(/_/g, ' ')}</span>` : ''}
                    ${order.completed_at && driver ? `<div class="timeline-meta">Completed by: ${driver.driver_id}</div>` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">Audit Log</div>
            <div class="card-content">
              ${auditLogs.length === 0 ? '<div style="text-align: center; padding: 12px; color: #9ca3af;">No activity recorded</div>' : ''}
              ${auditLogs.map((log) => `
                <div class="audit-item">
                  <div class="audit-action">${log.action.replace(/_/g, ' ')}</div>
                  <div class="audit-time">${log.user_full_name || 'System'} • ${new Date(log.created_at).toLocaleString()}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="footer">
            Generated on ${new Date().toLocaleString()} • Confidential Audit Record
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
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
        <div className="flex items-center justify-between px-4 lg:px-8 h-14 lg:h-16 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            {/* Desktop: Off-canvas menu */}
            <div className="hidden lg:block">
              <DesktopNav title="Order Edit" />
            </div>
            {/* Back button - visible on all screens */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/order-edits')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-sm lg:text-lg">
                {order.shipment_id || order.tracking_id}
              </h1>
              <p className="text-xs lg:text-sm text-muted-foreground">{order.client_name}</p>
            </div>
          </div>
          <Badge
            className={`text-xs lg:text-sm ${
              isCompleted
                ? order.timeline_status === 'COMPLETED_DELIVERED'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
                : isAssigned
                ? 'bg-blue-100 text-blue-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {order.timeline_status?.replace(/_/g, ' ') || 'Pending'}
          </Badge>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="max-w-7xl mx-auto w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-none border-b bg-background h-12 lg:h-14 lg:ml-8">
            <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm lg:text-base">
              Details
            </TabsTrigger>
            <TabsTrigger value="edit" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm lg:text-base">
              Edit Delivery
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Details Tab */}
        <TabsContent value="details" className="flex-1 overflow-y-auto pb-20 lg:pb-8 mt-0">
          <div className="p-4 lg:px-8 lg:py-6 max-w-7xl mx-auto">
            <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
              {!isAssigned ? (
                /* Not Assigned State */
                <Card className="lg:col-span-2">
                  <CardContent className="p-6 lg:p-10 text-center">
                    <AlertTriangle className="h-12 w-12 lg:h-16 lg:w-16 mx-auto text-amber-500 mb-4" />
                    <h3 className="font-semibold text-lg lg:text-xl mb-2">Order Not Assigned</h3>
                    <p className="text-muted-foreground mb-6 lg:text-lg">
                      This order has not been assigned to a driver yet.
                    </p>
                    <Button size="lg" onClick={handleAssignSystemDriver} disabled={isAssigning}>
                      <UserPlus className="h-5 w-5 mr-2" />
                      {isAssigning ? 'Assigning...' : 'Assign to System Driver'}
                    </Button>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-3">
                      Will assign to driver {SYSTEM_DRIVER_ID} and generate tracking
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                {/* Order Information */}
                <Card>
                  <CardHeader className="pb-3 lg:pb-4">
                    <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                      <Package className="h-4 w-4 lg:h-5 lg:w-5" />
                      Order Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 lg:space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm lg:text-base text-muted-foreground">Order Date</span>
                      <span className="text-sm lg:text-base font-medium">
                        {order.order_date ? new Date(order.order_date).toLocaleDateString() : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm lg:text-base text-muted-foreground">Shipment ID</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm lg:text-base">{order.shipment_id || '-'}</span>
                        {order.shipment_id && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(order.shipment_id!)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm lg:text-base text-muted-foreground">Tracking ID</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm lg:text-base">{order.tracking_id || '-'}</span>
                        {order.tracking_id && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(order.tracking_id!)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Info */}
                <Card>
                  <CardHeader className="pb-3 lg:pb-4">
                    <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                      <User className="h-4 w-4 lg:h-5 lg:w-5" />
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 lg:space-y-4">
                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm lg:text-base font-medium">{order.client_name || '-'}</p>
                        <p className="text-xs lg:text-sm text-muted-foreground">Health Card: {order.health_card_no || 'N/A'}</p>
                      </div>
                    </div>
                    {order.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
                        <span className="text-sm lg:text-base">{order.email}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm lg:text-base">{order.address_line_1}</p>
                        {order.address_line_2 && <p className="text-sm lg:text-base">{order.address_line_2}</p>}
                        <p className="text-xs lg:text-sm text-muted-foreground">{order.geo_zone}, {order.country}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Drug Info */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3 lg:pb-4">
                    <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                      <Pill className="h-4 w-4 lg:h-5 lg:w-5" />
                      Drug Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {order.authorizing_doctor_name && (
                      <div className="flex items-center gap-3 pb-3 border-b">
                        <User className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Authorizing Doctor</p>
                          <p className="text-sm lg:text-base font-medium">{order.authorizing_doctor_name}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Nasal Spray */}
                    {(order.nasal_drug_name || order.nasal_qty) && (
                      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Wind className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">Nasal Spray</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Drug Name</p>
                            <p className="text-sm font-medium">{order.nasal_drug_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Quantity</p>
                            <p className="text-sm font-medium">{order.nasal_qty || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">RX Number</p>
                            <p className="text-sm font-mono">{order.nasal_rx_number || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">DIN</p>
                            <p className="text-sm font-mono">{order.nasal_din || '-'}</p>
                          </div>
                          {order.nasal_package && (
                            <div className="col-span-2">
                              <p className="text-xs text-muted-foreground">Package</p>
                              <p className="text-sm">{order.nasal_package}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Injectable */}
                    {(order.injection_drug_name || order.injection_qty) && (
                      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Syringe className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">Injectable</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Drug Name</p>
                            <p className="text-sm font-medium">{order.injection_drug_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Quantity</p>
                            <p className="text-sm font-medium">{order.injection_qty || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">RX Number</p>
                            <p className="text-sm font-mono">{order.injection_rx_number || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">DIN</p>
                            <p className="text-sm font-mono">{order.injection_din || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Strength</p>
                            <p className="text-sm">{order.injection_strength || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Form</p>
                            <p className="text-sm">{order.injection_form || '-'}</p>
                          </div>
                          {order.injection_package && (
                            <div className="col-span-2">
                              <p className="text-xs text-muted-foreground">Package</p>
                              <p className="text-sm">{order.injection_package}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!order.nasal_drug_name && !order.nasal_qty && !order.injection_drug_name && !order.injection_qty && (
                      <p className="text-sm text-muted-foreground text-center py-4">No drug information available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Delivery Timeline */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3 lg:pb-4">
                    <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                      <Clock className="h-4 w-4 lg:h-5 lg:w-5" />
                      Delivery Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative pl-8">
                      {/* Timeline line */}
                      <div className="absolute left-3 top-6 bottom-6 w-0.5 bg-border" />
                      
                      {/* Pending */}
                      <div className="relative pb-6">
                        <div className={`absolute left-[-20px] w-6 h-6 rounded-full flex items-center justify-center ${order.pending_at ? 'bg-amber-100' : 'bg-muted'}`}>
                          <div className={`w-2 h-2 rounded-full ${order.pending_at ? 'bg-amber-500' : 'bg-muted-foreground'}`} />
                        </div>
                        <div className="ml-4">
                          <p className="font-medium text-sm lg:text-base">Pending</p>
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            {order.pending_at ? formatDateTime(order.pending_at) : 'Awaiting processing'}
                          </p>
                        </div>
                      </div>

                      {/* Picked Up & Assigned */}
                      <div className="relative pb-6">
                        <div className={`absolute left-[-20px] w-6 h-6 rounded-full flex items-center justify-center ${order.picked_up_at ? 'bg-blue-100' : 'bg-muted'}`}>
                          <Package className={`h-3 w-3 ${order.picked_up_at ? 'text-blue-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="ml-4">
                          <p className="font-medium text-sm lg:text-base">Picked Up & Assigned</p>
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            {order.picked_up_at ? formatDateTime(order.picked_up_at) : 'Not yet picked up'}
                          </p>
                          {order.picked_up_at && driver && (
                            <p className="text-xs text-primary mt-0.5">Assigned to: {driver.full_name} ({driver.driver_id})</p>
                          )}
                        </div>
                      </div>

                      {/* Confirmed */}
                      <div className="relative pb-6">
                        <div className={`absolute left-[-20px] w-6 h-6 rounded-full flex items-center justify-center ${order.confirmed_at ? 'bg-indigo-100' : 'bg-muted'}`}>
                          <CheckCircle className={`h-3 w-3 ${order.confirmed_at ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="ml-4">
                          <p className="font-medium text-sm lg:text-base">Confirmed</p>
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            {order.confirmed_at ? formatDateTime(order.confirmed_at) : 'Awaiting confirmation'}
                          </p>
                          {order.confirmed_at && driver && (
                            <p className="text-xs text-primary mt-0.5">Confirmed by: {driver.driver_id}</p>
                          )}
                        </div>
                      </div>

                      {/* In Route */}
                      <div className="relative pb-6">
                        <div className={`absolute left-[-20px] w-6 h-6 rounded-full flex items-center justify-center ${order.shipped_at || order.in_route_at ? 'bg-purple-100' : 'bg-muted'}`}>
                          <Navigation className={`h-3 w-3 ${order.shipped_at || order.in_route_at ? 'text-purple-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="ml-4">
                          <p className="font-medium text-sm lg:text-base">In Route</p>
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            {order.shipped_at || order.in_route_at ? formatDateTime(order.shipped_at || order.in_route_at) : 'Not in route yet'}
                          </p>
                          {(order.shipped_at || order.in_route_at) && driver && (
                            <p className="text-xs text-primary mt-0.5">In route by: {driver.driver_id}</p>
                          )}
                        </div>
                      </div>

                      {/* Delivered / Completed */}
                      <div className="relative">
                        <div className={`absolute left-[-20px] w-6 h-6 rounded-full flex items-center justify-center ${
                          order.completed_at 
                            ? order.timeline_status === 'COMPLETED_DELIVERED' 
                              ? 'bg-green-100' 
                              : 'bg-red-100'
                            : 'bg-muted'
                        }`}>
                          <Truck className={`h-3 w-3 ${
                            order.completed_at 
                              ? order.timeline_status === 'COMPLETED_DELIVERED' 
                                ? 'text-green-600' 
                                : 'text-red-600'
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div className="ml-4">
                          <p className="font-medium text-sm lg:text-base">
                            {order.timeline_status === 'COMPLETED_INCOMPLETE' ? 'Delivery Incomplete' : 'Delivered'}
                          </p>
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            {order.completed_at ? formatDateTime(order.completed_at) : 'Awaiting delivery'}
                          </p>
                          {order.delivery_status && (
                            <Badge 
                              className={`mt-1 text-xs ${
                                order.timeline_status === 'COMPLETED_DELIVERED' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {order.delivery_status.replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {order.completed_at && driver && (
                            <p className="text-xs text-primary mt-0.5">Completed by: {driver.driver_id}</p>
                          )}
                        </div>
                      </div>
                    </div>
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
                <Card className={driver ? '' : 'lg:col-span-2'}>
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
                      <Button size="sm" variant="outline" onClick={() => handleExportAuditPDF()}>
                        <FileDown className="h-4 w-4 mr-1" />
                        Export Audit PDF
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
          </div>
        </TabsContent>

        {/* Edit Delivery Tab */}
        <TabsContent value="edit" className="flex-1 overflow-y-auto pb-24 lg:pb-20 mt-0">
          <div className="p-4 lg:px-8 lg:py-6 max-w-7xl mx-auto">
            <div className="space-y-4 lg:max-w-2xl">
              {!isAssigned ? (
                <Card>
                  <CardContent className="p-6 lg:p-10 text-center">
                    <AlertTriangle className="h-12 w-12 lg:h-16 lg:w-16 mx-auto text-amber-500 mb-4" />
                    <h3 className="font-semibold lg:text-lg">Cannot Edit Delivery</h3>
                    <p className="text-sm lg:text-base text-muted-foreground">
                      Please assign the order to a driver first.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Current Status */}
                  <Card>
                    <CardContent className="p-4 lg:p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm lg:text-base font-medium">Current Status</span>
                        <Badge variant={isCompleted ? (order.timeline_status === 'COMPLETED_DELIVERED' ? 'default' : 'destructive') : 'secondary'}>
                          {order.timeline_status?.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Timeline Editor */}
                  <Card>
                    <CardHeader className="pb-3 lg:pb-4">
                      <CardTitle className="text-base lg:text-lg">Delivery Timeline</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 lg:space-y-8">
                      {/* Ordered - Read Only */}
                      <div className="flex gap-4 lg:gap-6">
                        <div className="flex flex-col items-center">
                          <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-amber-100 flex items-center justify-center">
                            <Package className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" />
                          </div>
                          <div className="w-0.5 h-full bg-border flex-1 mt-2" />
                        </div>
                        <div className="flex-1 pb-6 lg:pb-8">
                          <h4 className="font-medium lg:text-lg">Ordered</h4>
                          <p className="text-sm lg:text-base text-muted-foreground mt-1">
                            {order.order_date ? new Date(order.order_date).toLocaleDateString() : 'No date'}
                          </p>
                          <p className="text-xs lg:text-sm text-muted-foreground mt-1">Read-only</p>
                        </div>
                      </div>

                      {/* Picked Up */}
                      <div className="flex gap-4 lg:gap-6">
                        <div className="flex flex-col items-center">
                          <div className={`h-10 w-10 lg:h-12 lg:w-12 rounded-full flex items-center justify-center ${editPickedUpAt ? 'bg-blue-100' : 'bg-muted'}`}>
                            <CheckCircle className={`h-5 w-5 lg:h-6 lg:w-6 ${editPickedUpAt ? 'text-blue-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="w-0.5 h-full bg-border flex-1 mt-2" />
                        </div>
                        <div className="flex-1 pb-6 lg:pb-8">
                          <h4 className="font-medium lg:text-lg">Picked Up</h4>
                          <p className="text-xs lg:text-sm text-muted-foreground mb-2">When order was assigned to driver</p>
                          <Input
                            type="datetime-local"
                            value={editPickedUpAt}
                            onChange={(e) => setEditPickedUpAt(e.target.value)}
                            className="max-w-xs lg:max-w-sm"
                          />
                        </div>
                      </div>

                      {/* Shipped */}
                      <div className="flex gap-4 lg:gap-6">
                        <div className="flex flex-col items-center">
                          <div className={`h-10 w-10 lg:h-12 lg:w-12 rounded-full flex items-center justify-center ${editShippedAt ? 'bg-purple-100' : 'bg-muted'}`}>
                            <Navigation className={`h-5 w-5 lg:h-6 lg:w-6 ${editShippedAt ? 'text-purple-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="w-0.5 h-full bg-border flex-1 mt-2" />
                        </div>
                        <div className="flex-1 pb-6 lg:pb-8">
                          <h4 className="font-medium lg:text-lg">Shipped</h4>
                          <p className="text-xs lg:text-sm text-muted-foreground mb-2">When driver started transit</p>
                          <Input
                            type="datetime-local"
                            value={editShippedAt}
                            onChange={(e) => setEditShippedAt(e.target.value)}
                            className="max-w-xs lg:max-w-sm"
                          />
                      </div>
                    </div>

                      {/* Delivered */}
                      <div className="flex gap-4 lg:gap-6">
                        <div className="flex flex-col items-center">
                          <div className={`h-10 w-10 lg:h-12 lg:w-12 rounded-full flex items-center justify-center ${
                            editDeliveryStatus 
                              ? deliveryOutcomes.find(o => o.value === editDeliveryStatus)?.success 
                                ? 'bg-green-100' 
                                : 'bg-red-100'
                              : 'bg-muted'
                          }`}>
                            <Truck className={`h-5 w-5 lg:h-6 lg:w-6 ${
                              editDeliveryStatus 
                                ? deliveryOutcomes.find(o => o.value === editDeliveryStatus)?.success 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                                : 'text-muted-foreground'
                            }`} />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium lg:text-lg">Delivered</h4>
                          <p className="text-xs lg:text-sm text-muted-foreground mb-2">Delivery outcome</p>
                          <div className="space-y-3 lg:space-y-4">
                            <Select value={editDeliveryStatus} onValueChange={setEditDeliveryStatus}>
                              <SelectTrigger className="max-w-xs lg:max-w-sm">
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
                              className="max-w-xs lg:max-w-sm"
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
          </div>

          {/* Sticky Save Button */}
          {isAssigned && (
            <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 p-4 lg:p-6 bg-background border-t">
              <div className="max-w-7xl mx-auto lg:max-w-2xl lg:ml-8">
                <Button className="w-full lg:w-auto lg:px-12" size="lg" onClick={handleSaveDelivery} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
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
