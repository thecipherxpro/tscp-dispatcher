-- Update generate_shipment_id to use format: TSCPYYMMDD####
CREATE OR REPLACE FUNCTION public.generate_shipment_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  date_part TEXT;
  counter INTEGER;
BEGIN
  -- Use 2-digit year format: YYMMDD
  date_part := TO_CHAR(NOW() AT TIME ZONE 'America/Toronto', 'YYMMDD');
  
  -- Get the next counter for today
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(shipment_id FROM 11) AS INTEGER)
  ), 0) + 1
  INTO counter
  FROM public.orders
  WHERE shipment_id LIKE 'TSCP' || date_part || '%';
  
  -- Format: TSCPYYMMDD#### (no dashes)
  new_id := 'TSCP' || date_part || LPAD(counter::TEXT, 4, '0');
  RETURN new_id;
END;
$$;

-- Update generate_tracking_id to use format: ###T##S##CP
CREATE OR REPLACE FUNCTION public.generate_tracking_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  rand_digits TEXT;
BEGIN
  -- Generate 7 random digits and format as ###T##S##CP
  rand_digits := LPAD(FLOOR(RANDOM() * 10000000)::TEXT, 7, '0');
  
  RETURN SUBSTRING(rand_digits FROM 1 FOR 3) || 'T' || 
         SUBSTRING(rand_digits FROM 4 FOR 2) || 'S' || 
         SUBSTRING(rand_digits FROM 6 FOR 2) || 'CP';
END;
$$;