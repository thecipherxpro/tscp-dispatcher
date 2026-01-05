-- Create table for admin settings including package label configuration
CREATE TABLE public.admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'America/Toronto'::text),
  updated_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'America/Toronto'::text)
);

-- Enable Row Level Security
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view settings
CREATE POLICY "Admins can view settings" 
ON public.admin_settings 
FOR SELECT 
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

-- Only admins can update settings
CREATE POLICY "Admins can update settings" 
ON public.admin_settings 
FOR UPDATE 
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

-- Only admins can insert settings
CREATE POLICY "Admins can insert settings" 
ON public.admin_settings 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'pharmacy_admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default package label settings
INSERT INTO public.admin_settings (setting_key, setting_value) VALUES (
  'package_label',
  '{
    "from_company": "PharmaDocs+",
    "from_tagline": "Healthcare Delivery Service",
    "from_website": "www.endoverdose.ca",
    "contact_address": "3426 Lake Shore Blvd W",
    "contact_phone": "(844) 722-8829",
    "contact_email": "info@tscp.ca"
  }'::jsonb
);