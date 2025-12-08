import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, Profile, TimelineStatus } from '@/types/auth';
import { Json } from '@/integrations/supabase/types';

export function useOrders(enableRealtime = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setOrders(data as Order[]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Realtime subscription
  useEffect(() => {
    if (!enableRealtime) return;

    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => [payload.new as Order, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev => 
              prev.map(order => 
                order.id === payload.new.id ? (payload.new as Order) : order
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(order => order.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enableRealtime]);

  return { orders, isLoading, refetch: fetchOrders };
}

export function useDrivers() {
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'driver');

        if (roleData && roleData.length > 0) {
          const driverIds = roleData.map(r => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', driverIds);

          if (profiles) {
            setDrivers(profiles as Profile[]);
          }
        }
      } catch (error) {
        console.error('Error fetching drivers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrivers();
  }, []);

  return { drivers, isLoading };
}

export async function assignDriverToOrder(
  orderId: string,
  driverId: string,
  clientName: string | null,
  orderData: Partial<Order>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate shipment ID using database function
    const { data: shipmentIdData } = await supabase.rpc('generate_shipment_id');
    const shipmentId = shipmentIdData as string;

    // Generate tracking ID using database function
    const { data: trackingIdData } = await supabase.rpc('generate_tracking_id');
    const trackingId = trackingIdData as string;

    // Generate tracking URL
    const trackingUrl = `${window.location.origin}/track/${trackingId}`;

    // Get client initials
    const { data: initialsData } = await supabase.rpc('get_client_initials', {
      full_name: clientName || ''
    });
    const clientInitials = initialsData as string;

    const now = new Date().toISOString();

    // Update order - assignment sets status to PICKED_UP_AND_ASSIGNED
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        assigned_driver_id: driverId,
        shipment_id: shipmentId,
        tracking_id: trackingId,
        tracking_url: trackingUrl,
        timeline_status: 'PICKED_UP_AND_ASSIGNED' as TimelineStatus,
        picked_up_at: now,
        assigned_at: now,
      })
      .eq('id', orderId);

    if (orderError) throw orderError;

    // Upsert public tracking record
    const { error: trackingError } = await supabase
      .from('public_tracking')
      .upsert({
        tracking_id: trackingId,
        tracking_url: trackingUrl,
        shipment_id: shipmentId,
        order_id: orderId,
        driver_id: driverId,
        client_initials: clientInitials,
        doses_nasal: orderData.doses_nasal,
        nasal_rx: orderData.nasal_rx,
        doses_injectable: orderData.doses_injectable,
        injection_rx: orderData.injection_rx,
        city: orderData.city,
        province: orderData.province,
        postal_code: orderData.postal,
        country: orderData.country || 'Canada',
        timeline_status: 'PICKED_UP_AND_ASSIGNED' as TimelineStatus,
        pending_at: orderData.pending_at,
        picked_up_at: now,
        assigned_at: now,
      }, {
        onConflict: 'tracking_id'
      });

    if (trackingError) throw trackingError;

    return { success: true };
  } catch (error) {
    console.error('Error assigning driver:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateOrderStatus(
  orderId: string,
  trackingId: string | null,
  newStatus: TimelineStatus,
  deliveryStatus?: string,
  locationData?: {
    ip_address: string | null;
    geolocation: string | null;
    access_location: string | null;
  },
  reviewData?: {
    review_reason?: string;
    review_notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // First get the current order status for audit logging
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('timeline_status')
      .eq('id', orderId)
      .maybeSingle();

    const previousStatus = currentOrder?.timeline_status;
    const now = new Date().toISOString();
    
    // Map new status to timestamp fields
    const timestampField: Record<string, string> = {
      'CONFIRMED': 'confirmed_at',
      'IN_ROUTE': 'shipped_at',
      'COMPLETED_DELIVERED': 'completed_at',
      'COMPLETED_INCOMPLETE': 'completed_at',
      'REVIEW_REQUESTED': 'review_requested_at',
    };

    const updateData: Record<string, unknown> = {
      timeline_status: newStatus,
      [timestampField[newStatus] || 'updated_at']: now,
    };

    if (deliveryStatus) {
      updateData.delivery_status = deliveryStatus;
    }

    // Add review data if provided
    if (reviewData?.review_reason) {
      updateData.review_reason = reviewData.review_reason;
    }
    if (reviewData?.review_notes) {
      updateData.review_notes = reviewData.review_notes;
    }

    // Update order
    const { error: orderError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (orderError) throw orderError;

    // Update public tracking if tracking_id exists
    if (trackingId) {
      const { error: trackingError } = await supabase
        .from('public_tracking')
        .update(updateData)
        .eq('tracking_id', trackingId);

      if (trackingError) throw trackingError;
    }

    // Create audit log entry with location data
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    // Determine the internal audit action based on status
    let auditAction = 'STATUS_CHANGE';
    if (newStatus === 'COMPLETED_DELIVERED') {
      auditAction = 'DELIVERY_COMPLETED_SUCCESS';
    } else if (newStatus === 'COMPLETED_INCOMPLETE') {
      auditAction = 'DELIVERY_COMPLETED_INCOMPLETE';
    } else if (newStatus === 'IN_ROUTE') {
      auditAction = 'ORDER_SHIPPED';
    } else if (newStatus === 'CONFIRMED') {
      auditAction = 'ORDER_CONFIRMED';
    } else if (newStatus === 'REVIEW_REQUESTED') {
      auditAction = 'REVIEW_REQUESTED';
    }

    await supabase
      .from('order_audit_logs')
      .insert([{
        order_id: orderId,
        user_id: userId,
        action: auditAction,
        previous_status: previousStatus,
        new_status: newStatus,
        delivery_status: deliveryStatus,
        user_agent: navigator.userAgent,
        ip_address: locationData?.ip_address || null,
        geolocation: locationData?.geolocation || null,
        access_location: locationData?.access_location || null,
        metadata: { 
          trackingId,
          review_reason: reviewData?.review_reason,
          review_notes: reviewData?.review_notes
        } as Json
      }]);

    return { success: true };
  } catch (error) {
    console.error('Error updating status:', error);
    return { success: false, error: (error as Error).message };
  }
}
