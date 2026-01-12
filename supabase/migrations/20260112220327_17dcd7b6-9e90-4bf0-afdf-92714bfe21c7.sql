-- Create a table for storing standard order fields that can be mapped during CSV import
CREATE TABLE public.standard_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.standard_fields ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view standard fields" 
ON public.standard_fields 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'pharmacy_admin'
  )
);

CREATE POLICY "Admins can insert standard fields" 
ON public.standard_fields 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'pharmacy_admin'
  )
);

CREATE POLICY "Admins can update standard fields" 
ON public.standard_fields 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'pharmacy_admin'
  )
);

CREATE POLICY "Admins can delete standard fields" 
ON public.standard_fields 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'pharmacy_admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_standard_fields_updated_at
BEFORE UPDATE ON public.standard_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default standard fields
INSERT INTO public.standard_fields (field_key, field_label, field_type, is_required, sort_order) VALUES
  ('order_date', 'Order Date', 'date', false, 1),
  ('shipping_date', 'Shipping Date', 'date', false, 2),
  ('client_name', 'Client Name', 'text', true, 3),
  ('email', 'Email', 'text', false, 4),
  ('address_line_1', 'Address Line 1', 'text', true, 5),
  ('address_line_2', 'Address Line 2', 'text', false, 6),
  ('health_card_no', 'Health Card No.', 'text', false, 7),
  ('notes', 'Notes', 'text', false, 8),
  ('warehouse_address', 'Warehouse Address', 'text', false, 9),
  ('authorizing_doctor_name', 'Doctor Name', 'text', false, 10);