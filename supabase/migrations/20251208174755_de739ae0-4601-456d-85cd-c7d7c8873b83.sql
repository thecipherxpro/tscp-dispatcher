-- Drop the old timeline_status enum and create the new one
-- First, we need to alter columns to text, then recreate the enum

-- Update orders table columns to text temporarily
ALTER TABLE public.orders 
  ALTER COLUMN timeline_status DROP DEFAULT,
  ALTER COLUMN timeline_status TYPE text USING timeline_status::text;

-- Update public_tracking table columns to text temporarily
ALTER TABLE public.public_tracking 
  ALTER COLUMN timeline_status DROP DEFAULT,
  ALTER COLUMN timeline_status TYPE text USING timeline_status::text;

-- Drop the old enum
DROP TYPE IF EXISTS public.timeline_status;

-- Create new timeline_status enum with correct values
CREATE TYPE public.timeline_status AS ENUM (
  'PENDING',
  'PICKED_UP', 
  'SHIPPED',
  'DELIVERED',
  'DELIVERY_INCOMPLETE'
);

-- Convert existing data to new enum values
UPDATE public.orders SET timeline_status = 
  CASE 
    WHEN timeline_status = 'CONFIRMED' THEN 'PICKED_UP'
    WHEN timeline_status = 'IN_ROUTE' THEN 'SHIPPED'
    WHEN timeline_status = 'ARRIVED' THEN 'SHIPPED'
    WHEN timeline_status = 'REQUEST_ADDRESS_REVIEW' THEN 'PICKED_UP'
    WHEN timeline_status = 'COMPLETED' THEN 'DELIVERED'
    ELSE COALESCE(timeline_status, 'PENDING')
  END;

UPDATE public.public_tracking SET timeline_status = 
  CASE 
    WHEN timeline_status = 'CONFIRMED' THEN 'PICKED_UP'
    WHEN timeline_status = 'IN_ROUTE' THEN 'SHIPPED'
    WHEN timeline_status = 'ARRIVED' THEN 'SHIPPED'
    WHEN timeline_status = 'REQUEST_ADDRESS_REVIEW' THEN 'PICKED_UP'
    WHEN timeline_status = 'COMPLETED' THEN 'DELIVERED'
    ELSE COALESCE(timeline_status, 'PENDING')
  END;

-- Convert back to enum type
ALTER TABLE public.orders 
  ALTER COLUMN timeline_status TYPE public.timeline_status USING timeline_status::public.timeline_status,
  ALTER COLUMN timeline_status SET DEFAULT 'PENDING'::public.timeline_status;

ALTER TABLE public.public_tracking 
  ALTER COLUMN timeline_status TYPE public.timeline_status USING timeline_status::public.timeline_status,
  ALTER COLUMN timeline_status SET DEFAULT 'PENDING'::public.timeline_status;

-- Add new timestamp columns to orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMP WITH TIME ZONE;

-- Migrate existing timestamp data
UPDATE public.orders SET 
  picked_up_at = COALESCE(confirmed_at, address_review_requested_at),
  shipped_at = in_route_at,
  review_requested_at = address_review_requested_at;

-- Add new timestamp columns to public_tracking table
ALTER TABLE public.public_tracking 
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMP WITH TIME ZONE;

-- Migrate existing timestamp data for public_tracking
UPDATE public.public_tracking SET 
  picked_up_at = COALESCE(confirmed_at, address_review_requested_at),
  shipped_at = in_route_at,
  review_requested_at = address_review_requested_at;