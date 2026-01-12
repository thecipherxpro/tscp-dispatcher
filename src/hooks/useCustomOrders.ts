import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CustomOrder {
  id: string;
  client_name: string | null;
  email: string | null;
  health_card_no: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  warehouse_address: string | null;
  authorizing_doctor_name: string | null;
  order_date: string | null;
  shipping_date: string | null;
  notes: string | null;
  // Injection fields
  injection_rx_number: string | null;
  injection_din: string | null;
  injection_drug_name: string | null;
  injection_qty: number | null;
  injection_strength: string | null;
  injection_form: string | null;
  injection_package: string | null;
  injection_billing_date: string | null;
  // Nasal fields
  nasal_rx_number: string | null;
  nasal_din: string | null;
  nasal_drug_name: string | null;
  nasal_qty: number | null;
  nasal_package: string | null;
  nasal_billing_date: string | null;
  // Generated IDs
  shipment_id: string | null;
  tracking_id: string | null;
  tracking_url: string | null;
  // Geocoding
  latitude: number | null;
  longitude: number | null;
  geo_zone: string | null;
  country: string | null;
  // Label metadata
  label_shipped_at: string | null;
  label_delivered_at: string | null;
  label_status: string | null;
  // Timestamps
  created_at: string | null;
  updated_at: string | null;
}

export function useCustomOrders() {
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_orders')
        .select('*')
        .order('order_date', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching custom orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch custom orders',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const deleteOrders = useCallback(async (orderIds: string[]) => {
    try {
      const { error } = await supabase
        .from('custom_orders')
        .delete()
        .in('id', orderIds);

      if (error) throw error;
      
      toast({
        title: 'Deleted',
        description: `${orderIds.length} order(s) deleted successfully`,
      });
      
      await fetchOrders();
      return true;
    } catch (error: any) {
      console.error('Error deleting custom orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete orders',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchOrders, toast]);

  const moveToOrders = useCallback(async (orderIds: string[]) => {
    try {
      // Get the selected custom orders
      const ordersToMove = orders.filter(o => orderIds.includes(o.id));
      
      if (ordersToMove.length === 0) {
        toast({
          title: 'Error',
          description: 'No orders selected',
          variant: 'destructive',
        });
        return false;
      }

      // Insert into orders table
      for (const order of ordersToMove) {
        // Generate shipment and tracking IDs
        const { data: shipmentIdData } = await supabase.rpc('generate_shipment_id');
        const shipmentId = shipmentIdData as string;

        const { data: trackingIdData } = await supabase.rpc('generate_tracking_id');
        const trackingId = trackingIdData as string;

        const trackingUrl = `${window.location.origin}/track/${trackingId}`;

        const { error: insertError } = await supabase
          .from('orders')
          .insert({
            client_name: order.client_name,
            email: order.email,
            health_card_no: order.health_card_no,
            address_line_1: order.address_line_1,
            address_line_2: order.address_line_2,
            warehouse_address: order.warehouse_address,
            authorizing_doctor_name: order.authorizing_doctor_name,
            order_date: order.order_date,
            shipping_date: order.shipping_date,
            notes: order.notes,
            injection_rx_number: order.injection_rx_number,
            injection_din: order.injection_din,
            injection_drug_name: order.injection_drug_name,
            injection_qty: order.injection_qty,
            injection_strength: order.injection_strength,
            injection_form: order.injection_form,
            injection_package: order.injection_package,
            injection_billing_date: order.injection_billing_date,
            nasal_rx_number: order.nasal_rx_number,
            nasal_din: order.nasal_din,
            nasal_drug_name: order.nasal_drug_name,
            nasal_qty: order.nasal_qty,
            nasal_package: order.nasal_package,
            nasal_billing_date: order.nasal_billing_date,
            shipment_id: shipmentId,
            tracking_id: trackingId,
            tracking_url: trackingUrl,
            latitude: order.latitude,
            longitude: order.longitude,
            geo_zone: order.geo_zone,
            country: order.country,
            timeline_status: 'PENDING',
            pending_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      // Delete from custom_orders after successful move
      const { error: deleteError } = await supabase
        .from('custom_orders')
        .delete()
        .in('id', orderIds);

      if (deleteError) throw deleteError;

      toast({
        title: 'Moved Successfully',
        description: `${ordersToMove.length} order(s) moved to Orders for delivery`,
      });

      await fetchOrders();
      return true;
    } catch (error: any) {
      console.error('Error moving orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to move orders',
        variant: 'destructive',
      });
      return false;
    }
  }, [orders, fetchOrders, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    isLoading,
    refetch: fetchOrders,
    deleteOrders,
    moveToOrders,
  };
}
