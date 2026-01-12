-- Add phone column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add phone column to custom_orders table for consistency
ALTER TABLE public.custom_orders ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add phone column to public_tracking if needed for display
ALTER TABLE public.public_tracking ADD COLUMN IF NOT EXISTS phone TEXT;