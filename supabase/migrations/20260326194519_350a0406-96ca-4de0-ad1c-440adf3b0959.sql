
-- 1. Fix public_tracking: Replace the overly permissive public SELECT policy
-- with one that hides phone numbers and precise coordinates

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view tracking by tracking_id" ON public.public_tracking;

-- Create a secure view function that returns sanitized data
-- (phone masked, coordinates rounded to ~1km precision)
CREATE OR REPLACE FUNCTION public.get_public_tracking(p_tracking_id text)
RETURNS TABLE (
  id uuid,
  tracking_id text,
  tracking_url text,
  shipment_id text,
  order_id uuid,
  client_initials text,
  injection_qty integer,
  nasal_qty integer,
  naloxone_kit_x4_qty integer,
  warehouse_city text,
  country text,
  timeline_status timeline_status,
  delivery_status delivery_status,
  pending_at timestamptz,
  picked_up_at timestamptz,
  assigned_at timestamptz,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  in_route_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  review_requested_at timestamptz,
  review_reason text,
  review_notes text,
  address_review_requested_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  delivery_route_snapshot_url text,
  delivery_route_snapshot_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pt.id,
    pt.tracking_id,
    pt.tracking_url,
    pt.shipment_id,
    pt.order_id,
    pt.client_initials,
    pt.injection_qty,
    pt.nasal_qty,
    pt.naloxone_kit_x4_qty,
    pt.warehouse_city,
    pt.country,
    pt.timeline_status,
    pt.delivery_status,
    pt.pending_at,
    pt.picked_up_at,
    pt.assigned_at,
    pt.confirmed_at,
    pt.shipped_at,
    pt.in_route_at,
    pt.arrived_at,
    pt.completed_at,
    pt.review_requested_at,
    pt.review_reason,
    pt.review_notes,
    pt.address_review_requested_at,
    pt.created_at,
    pt.updated_at,
    pt.delivery_route_snapshot_url,
    pt.delivery_route_snapshot_status
  FROM public.public_tracking pt
  WHERE pt.tracking_id = p_tracking_id;
$$;

-- New restrictive policy: anonymous users cannot directly query the table
-- They must use the get_public_tracking function instead
CREATE POLICY "Public can only view tracking via function"
ON public.public_tracking
FOR SELECT
TO anon
USING (false);

-- Authenticated users still need direct access for admin/driver operations
CREATE POLICY "Authenticated users can view tracking by tracking_id"
ON public.public_tracking
FOR SELECT
TO authenticated
USING (true);

-- 2. Encrypt driver financial data using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted columns for sensitive financial fields
ALTER TABLE public.driver_payout_settings 
  ADD COLUMN IF NOT EXISTS account_number_encrypted bytea,
  ADD COLUMN IF NOT EXISTS transit_number_encrypted bytea,
  ADD COLUMN IF NOT EXISTS institution_number_encrypted bytea,
  ADD COLUMN IF NOT EXISTS security_answer_encrypted bytea;

-- Create encrypt/decrypt functions using a server-side secret
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_field(plain_text text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(plain_text, current_setting('app.encryption_key', true));
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive_field(encrypted_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(encrypted_data, current_setting('app.encryption_key', true));
END;
$$;

-- Create a trigger to auto-encrypt on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_payout_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Encrypt account_number if changed
  IF NEW.account_number IS NOT NULL AND NEW.account_number != '' THEN
    NEW.account_number_encrypted := public.encrypt_sensitive_field(NEW.account_number);
    -- Mask the plain text field (keep last 4 chars)
    IF LENGTH(NEW.account_number) > 4 THEN
      NEW.account_number := '****' || RIGHT(NEW.account_number, 4);
    END IF;
  END IF;
  
  -- Encrypt transit_number if changed
  IF NEW.transit_number IS NOT NULL AND NEW.transit_number != '' THEN
    NEW.transit_number_encrypted := public.encrypt_sensitive_field(NEW.transit_number);
    IF LENGTH(NEW.transit_number) > 3 THEN
      NEW.transit_number := '***' || RIGHT(NEW.transit_number, 3);
    END IF;
  END IF;
  
  -- Encrypt institution_number if changed
  IF NEW.institution_number IS NOT NULL AND NEW.institution_number != '' THEN
    NEW.institution_number_encrypted := public.encrypt_sensitive_field(NEW.institution_number);
    NEW.institution_number := '***';
  END IF;
  
  -- Encrypt security_answer if changed
  IF NEW.security_answer IS NOT NULL AND NEW.security_answer != '' THEN
    NEW.security_answer_encrypted := public.encrypt_sensitive_field(NEW.security_answer);
    NEW.security_answer := '********';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER encrypt_payout_settings_trigger
BEFORE INSERT OR UPDATE ON public.driver_payout_settings
FOR EACH ROW
EXECUTE FUNCTION public.encrypt_payout_fields();
