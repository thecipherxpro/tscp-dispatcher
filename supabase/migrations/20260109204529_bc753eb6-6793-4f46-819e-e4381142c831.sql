-- Add distance tracking to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_distance_km NUMERIC(10,2);

-- Create driver_earnings table
CREATE TABLE public.driver_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shipment_id TEXT,
  distance_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  base_rate NUMERIC(10,2) NOT NULL DEFAULT 4.00,
  per_km_rate NUMERIC(10,2) NOT NULL DEFAULT 0.50,
  distance_earnings NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL,
  payout_period_start DATE,
  payout_period_end DATE,
  payout_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'America/Toronto')
);

-- Create driver_payout_settings table
CREATE TABLE public.driver_payout_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID UNIQUE NOT NULL,
  payout_method TEXT,
  legal_name TEXT,
  bank_name TEXT,
  e_transfer_email TEXT,
  auto_deposit BOOLEAN DEFAULT true,
  security_question TEXT,
  security_answer TEXT,
  institution_name TEXT,
  transit_number TEXT,
  institution_number TEXT,
  account_number TEXT,
  first_order_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'America/Toronto'),
  updated_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'America/Toronto')
);

-- Create driver_pay_stubs table
CREATE TABLE public.driver_pay_stubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_distance_km NUMERIC(10,2) DEFAULT 0,
  total_earnings NUMERIC(10,2) DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'America/Toronto'),
  is_auto_generated BOOLEAN DEFAULT false,
  stub_data JSONB
);

-- Enable RLS on all new tables
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_pay_stubs ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_earnings
CREATE POLICY "Drivers can view their own earnings"
ON public.driver_earnings FOR SELECT
USING (driver_id = auth.uid());

CREATE POLICY "Drivers can insert their own earnings"
ON public.driver_earnings FOR INSERT
WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Admins can view all earnings"
ON public.driver_earnings FOR SELECT
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can manage all earnings"
ON public.driver_earnings FOR ALL
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

-- RLS policies for driver_payout_settings
CREATE POLICY "Drivers can view their own payout settings"
ON public.driver_payout_settings FOR SELECT
USING (driver_id = auth.uid());

CREATE POLICY "Drivers can insert their own payout settings"
ON public.driver_payout_settings FOR INSERT
WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Drivers can update their own payout settings"
ON public.driver_payout_settings FOR UPDATE
USING (driver_id = auth.uid());

CREATE POLICY "Admins can view all payout settings"
ON public.driver_payout_settings FOR SELECT
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can manage all payout settings"
ON public.driver_payout_settings FOR ALL
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

-- RLS policies for driver_pay_stubs
CREATE POLICY "Drivers can view their own pay stubs"
ON public.driver_pay_stubs FOR SELECT
USING (driver_id = auth.uid());

CREATE POLICY "Drivers can insert their own pay stubs"
ON public.driver_pay_stubs FOR INSERT
WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Admins can view all pay stubs"
ON public.driver_pay_stubs FOR SELECT
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can manage all pay stubs"
ON public.driver_pay_stubs FOR ALL
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

-- Create updated_at trigger for payout_settings
CREATE TRIGGER update_driver_payout_settings_updated_at
BEFORE UPDATE ON public.driver_payout_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();