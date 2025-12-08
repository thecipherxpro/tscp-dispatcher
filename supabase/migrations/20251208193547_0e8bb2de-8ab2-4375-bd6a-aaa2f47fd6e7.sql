-- Drop existing timeline_status type and recreate with new values
-- First, update any existing data to valid values for migration
UPDATE public.orders SET timeline_status = 'PENDING' WHERE timeline_status IS NULL;
UPDATE public.public_tracking SET timeline_status = 'PENDING' WHERE timeline_status IS NULL;

-- Create new enum type
CREATE TYPE timeline_status_new AS ENUM (
  'PENDING',
  'PICKED_UP_AND_ASSIGNED',
  'REVIEW_REQUESTED',
  'CONFIRMED',
  'IN_ROUTE',
  'ARRIVED',
  'COMPLETED_DELIVERED',
  'COMPLETED_INCOMPLETE'
);

-- Update orders table - convert old statuses to new
ALTER TABLE public.orders 
  ALTER COLUMN timeline_status DROP DEFAULT;

ALTER TABLE public.orders 
  ALTER COLUMN timeline_status TYPE timeline_status_new 
  USING CASE 
    WHEN timeline_status::text = 'PENDING' THEN 'PENDING'::timeline_status_new
    WHEN timeline_status::text = 'PICKED_UP' THEN 'PICKED_UP_AND_ASSIGNED'::timeline_status_new
    WHEN timeline_status::text = 'SHIPPED' THEN 'IN_ROUTE'::timeline_status_new
    WHEN timeline_status::text = 'DELIVERED' THEN 'COMPLETED_DELIVERED'::timeline_status_new
    WHEN timeline_status::text = 'DELIVERY_INCOMPLETE' THEN 'COMPLETED_INCOMPLETE'::timeline_status_new
    ELSE 'PENDING'::timeline_status_new
  END;

ALTER TABLE public.orders 
  ALTER COLUMN timeline_status SET DEFAULT 'PENDING'::timeline_status_new;

-- Update public_tracking table
ALTER TABLE public.public_tracking 
  ALTER COLUMN timeline_status DROP DEFAULT;

ALTER TABLE public.public_tracking 
  ALTER COLUMN timeline_status TYPE timeline_status_new 
  USING CASE 
    WHEN timeline_status::text = 'PENDING' THEN 'PENDING'::timeline_status_new
    WHEN timeline_status::text = 'PICKED_UP' THEN 'PICKED_UP_AND_ASSIGNED'::timeline_status_new
    WHEN timeline_status::text = 'SHIPPED' THEN 'IN_ROUTE'::timeline_status_new
    WHEN timeline_status::text = 'DELIVERED' THEN 'COMPLETED_DELIVERED'::timeline_status_new
    WHEN timeline_status::text = 'DELIVERY_INCOMPLETE' THEN 'COMPLETED_INCOMPLETE'::timeline_status_new
    ELSE 'PENDING'::timeline_status_new
  END;

ALTER TABLE public.public_tracking 
  ALTER COLUMN timeline_status SET DEFAULT 'PENDING'::timeline_status_new;

-- Drop old type and rename new
DROP TYPE IF EXISTS timeline_status;
ALTER TYPE timeline_status_new RENAME TO timeline_status;

-- Add new columns to orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Add new columns to public_tracking table
ALTER TABLE public.public_tracking 
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;