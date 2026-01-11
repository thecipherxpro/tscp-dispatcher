-- Create custom_orders table for not-ready orders
CREATE TABLE public.custom_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name text,
  email text,
  health_card_no text,
  address_line_1 text,
  address_line_2 text,
  warehouse_address text,
  authorizing_doctor_name text,
  order_date date,
  shipping_date date,
  notes text,
  -- Injection fields
  injection_rx_number text,
  injection_din text,
  injection_drug_name text,
  injection_qty integer,
  injection_strength text,
  injection_form text,
  injection_package text,
  injection_billing_date date,
  -- Nasal fields  
  nasal_rx_number text,
  nasal_din text,
  nasal_drug_name text,
  nasal_qty integer,
  nasal_package text,
  nasal_billing_date date,
  -- Generated IDs (for label purposes only)
  shipment_id text,
  tracking_id text,
  tracking_url text,
  -- Geocoding
  latitude double precision,
  longitude double precision,
  geo_zone text,
  country text DEFAULT 'Canada',
  -- Label metadata (what was printed)
  label_shipped_at timestamp with time zone,
  label_delivered_at timestamp with time zone,
  label_status text,
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policy for pharmacy admins
CREATE POLICY "Admins can view custom_orders" 
  ON public.custom_orders 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can insert custom_orders" 
  ON public.custom_orders 
  FOR INSERT 
  WITH CHECK (public.has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can update custom_orders" 
  ON public.custom_orders 
  FOR UPDATE 
  USING (public.has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can delete custom_orders" 
  ON public.custom_orders 
  FOR DELETE 
  USING (public.has_role(auth.uid(), 'pharmacy_admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_custom_orders_updated_at
  BEFORE UPDATE ON public.custom_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();