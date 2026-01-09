import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, Profile, TimelineStatus } from '@/types/auth';
import { Json } from '@/integrations/supabase/types';
import { calculateEarnings } from './useDriverEarnings';

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
              ).sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
              })
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
    const { data: shipmentIdData } = await supabase.rpc('generate_shipment_id');
    const shipmentId = shipmentIdData as string;

    const { data: trackingIdData } = await supabase.rpc('generate_tracking_id');
    const trackingId = trackingIdData as string;

    const trackingUrl = `${window.location.origin}/track/${trackingId}`;

    const { data: initialsData } = await supabase.rpc('get_client_initials', {
      full_name: clientName || ''
    });
    const clientInitials = initialsData as string;

    const now = new Date().toISOString();

    // Extract city from warehouse address for public tracking
    const warehouseAddress = orderData.warehouse_address || '';
    const warehouseParts = warehouseAddress.split(',').map(p => p.trim());
    const warehouseCity = warehouseParts.length >= 2 ? warehouseParts[warehouseParts.length - 2] : warehouseParts[0] || null;

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

    const { error: trackingError } = await supabase
      .from('public_tracking')
      .upsert({
        tracking_id: trackingId,
        tracking_url: trackingUrl,
        shipment_id: shipmentId,
        order_id: orderId,
        driver_id: driverId,
        client_initials: clientInitials,
        injection_qty: orderData.injection_qty,
        nasal_qty: orderData.nasal_qty,
        warehouse_city: warehouseCity,
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

export async function generateTrackingForOrders(
  orders: Order[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      // Skip if already has tracking
      if (order.tracking_id && order.shipment_id) {
        success++;
        continue;
      }

      const { data: shipmentIdData } = await supabase.rpc('generate_shipment_id');
      const shipmentId = shipmentIdData as string;

      const { data: trackingIdData } = await supabase.rpc('generate_tracking_id');
      const trackingId = trackingIdData as string;

      const trackingUrl = `${window.location.origin}/track/${trackingId}`;

      const { data: initialsData } = await supabase.rpc('get_client_initials', {
        full_name: order.client_name || ''
      });
      const clientInitials = initialsData as string;

      const now = new Date().toISOString();

      // Extract city from warehouse address for public tracking
      const warehouseAddress = order.warehouse_address || '';
      const warehouseParts = warehouseAddress.split(',').map(p => p.trim());
      const warehouseCity = warehouseParts.length >= 2 ? warehouseParts[warehouseParts.length - 2] : warehouseParts[0] || null;

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          shipment_id: shipmentId,
          tracking_id: trackingId,
          tracking_url: trackingUrl,
          shipped_at: now,
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      const { error: trackingError } = await supabase
        .from('public_tracking')
        .upsert({
          tracking_id: trackingId,
          tracking_url: trackingUrl,
          shipment_id: shipmentId,
          order_id: order.id,
          client_initials: clientInitials,
          injection_qty: order.injection_qty,
          nasal_qty: order.nasal_qty,
          warehouse_city: warehouseCity,
          country: order.country || 'Canada',
          latitude: order.latitude,
          longitude: order.longitude,
          geo_zone: order.geo_zone,
          timeline_status: order.timeline_status || 'PENDING',
          pending_at: order.pending_at || now,
          shipped_at: now,
        }, {
          onConflict: 'tracking_id'
        });

      if (trackingError) {
        console.warn('Tracking upsert error:', trackingError);
      }

      success++;
    } catch (error) {
      console.error('Error generating tracking for order:', order.id, error);
      failed++;
    }
  }

  return { success, failed };
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
  },
  distanceKm?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('timeline_status')
      .eq('id', orderId)
      .maybeSingle();

    const previousStatus = currentOrder?.timeline_status;
    const now = new Date().toISOString();
    
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

    if (reviewData?.review_reason) {
      updateData.review_reason = reviewData.review_reason;
    }
    if (reviewData?.review_notes) {
      updateData.review_notes = reviewData.review_notes;
    }

    // Add distance if provided (for completed orders)
    if (distanceKm !== undefined) {
      updateData.delivery_distance_km = distanceKm;
    }

    const { error: orderError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (orderError) throw orderError;

    if (trackingId) {
      const { error: trackingError } = await supabase
        .from('public_tracking')
        .update(updateData)
        .eq('tracking_id', trackingId);

      if (trackingError) throw trackingError;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

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

    // Create driver earnings record when order is completed
    if ((newStatus === 'COMPLETED_DELIVERED' || newStatus === 'COMPLETED_INCOMPLETE') && userId) {
      // Get order details for earnings
      const { data: orderData } = await supabase
        .from('orders')
        .select('shipment_id, assigned_driver_id, delivery_distance_km')
        .eq('id', orderId)
        .maybeSingle();

      if (orderData && orderData.assigned_driver_id) {
        const distance = distanceKm ?? orderData.delivery_distance_km ?? 0;
        const earnings = calculateEarnings(distance);

        await supabase
          .from('driver_earnings')
          .insert({
            driver_id: orderData.assigned_driver_id,
            order_id: orderId,
            shipment_id: orderData.shipment_id,
            distance_km: distance,
            base_rate: earnings.baseRate,
            per_km_rate: earnings.perKmRate,
            distance_earnings: earnings.distanceEarnings,
            total_earnings: earnings.totalEarnings,
            completed_at: now,
            payout_status: 'pending',
          });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating status:', error);
    return { success: false, error: (error as Error).message };
  }
}
