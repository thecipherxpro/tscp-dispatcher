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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    isLoading,
    refetch: fetchOrders,
    deleteOrders,
  };
}
