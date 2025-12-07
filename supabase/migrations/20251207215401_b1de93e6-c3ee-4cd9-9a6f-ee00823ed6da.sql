-- Fix the generate_tracking_id function to use gen_random_uuid instead of gen_random_bytes
CREATE OR REPLACE FUNCTION public.generate_tracking_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Use gen_random_uuid and remove hyphens for a clean tracking ID
  RETURN REPLACE(gen_random_uuid()::text, '-', '');
END;
$$;