-- Add geocoding and zone fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS geo_zone TEXT;

-- Add same fields to public_tracking for consistency
ALTER TABLE public.public_tracking 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS geo_zone TEXT;