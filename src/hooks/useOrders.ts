import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, Profile } from '@/types/auth';
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

    // Update order
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        assigned_driver_id: driverId,
        shipment_id: shipmentId,
        tracking_id: trackingId,
        tracking_url: trackingUrl,
        timeline_status: 'CONFIRMED',
        confirmed_at: now,
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
        timeline_status: 'CONFIRMED',
        pending_at: orderData.pending_at,
        confirmed_at: now,
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
  newStatus: string,
  deliveryStatus?: string
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
    
    const timestampField: Record<string, string> = {
      'IN_ROUTE': 'in_route_at',
      'ARRIVED': 'arrived_at',
      'COMPLETED': 'completed_at',
      'REQUEST_ADDRESS_REVIEW': 'address_review_requested_at',
    };

    const updateData: Record<string, unknown> = {
      timeline_status: newStatus,
      [timestampField[newStatus]]: now,
    };

    if (deliveryStatus) {
      updateData.delivery_status = deliveryStatus;
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

    // Create audit log entry
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    await supabase
      .from('order_audit_logs')
      .insert([{
        order_id: orderId,
        user_id: userId,
        action: deliveryStatus ? 'DELIVERY_COMPLETED' : 'STATUS_CHANGE',
        previous_status: previousStatus,
        new_status: newStatus,
        delivery_status: deliveryStatus,
        user_agent: navigator.userAgent,
        metadata: { trackingId } as Json
      }]);

    return { success: true };
  } catch (error) {
    console.error('Error updating status:', error);
    return { success: false, error: (error as Error).message };
  }
}
