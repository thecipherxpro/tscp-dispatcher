
-- PHASE 1: Remove old columns from orders table
ALTER TABLE public.orders 
  DROP COLUMN IF EXISTS call_datetime,
  DROP COLUMN IF EXISTS billing_date,
  DROP COLUMN IF EXISTS ship_date,
  DROP COLUMN IF EXISTS doses_nasal,
  DROP COLUMN IF EXISTS nasal_rx,
  DROP COLUMN IF EXISTS doses_injectable,
  DROP COLUMN IF EXISTS injection_rx,
  DROP COLUMN IF EXISTS tracking_url_source,
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS dob,
  DROP COLUMN IF EXISTS health_card,
  DROP COLUMN IF EXISTS phone_number,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS call_notes,
  DROP COLUMN IF EXISTS address_1,
  DROP COLUMN IF EXISTS address_2,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS province,
  DROP COLUMN IF EXISTS postal,
  DROP COLUMN IF EXISTS province_1,
  DROP COLUMN IF EXISTS shipment_id_import,
  DROP COLUMN IF EXISTS driver_id_import,
  DROP COLUMN IF EXISTS authorizing_pharmacist,
  DROP COLUMN IF EXISTS training_status,
  DROP COLUMN IF EXISTS pharmacy_name;

-- PHASE 2: Add new columns to orders table

-- Customer & Order fields
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS order_date date,
  ADD COLUMN IF NOT EXISTS shipping_date date,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS health_card_no text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Address fields  
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS warehouse_address text;

-- Doctor field
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS authorizing_doctor_name text;

-- Drug Data (Injection)
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS injection_rx_number text,
  ADD COLUMN IF NOT EXISTS injection_din text,
  ADD COLUMN IF NOT EXISTS injection_drug_name text,
  ADD COLUMN IF NOT EXISTS injection_strength text,
  ADD COLUMN IF NOT EXISTS injection_form text,
  ADD COLUMN IF NOT EXISTS injection_package text,
  ADD COLUMN IF NOT EXISTS injection_qty integer,
  ADD COLUMN IF NOT EXISTS injection_billing_date date;

-- Drug Data (Nasal)
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS nasal_rx_number text,
  ADD COLUMN IF NOT EXISTS nasal_din text,
  ADD COLUMN IF NOT EXISTS nasal_drug_name text,
  ADD COLUMN IF NOT EXISTS nasal_package text,
  ADD COLUMN IF NOT EXISTS nasal_qty integer,
  ADD COLUMN IF NOT EXISTS nasal_billing_date date;

-- PHASE 2B: Update public_tracking table for new schema
-- Remove old columns
ALTER TABLE public.public_tracking
  DROP COLUMN IF EXISTS doses_nasal,
  DROP COLUMN IF EXISTS doses_injectable,
  DROP COLUMN IF EXISTS nasal_rx,
  DROP COLUMN IF EXISTS injection_rx,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS province,
  DROP COLUMN IF EXISTS postal_code;

-- Add new columns for drug quantities
ALTER TABLE public.public_tracking
  ADD COLUMN IF NOT EXISTS injection_qty integer,
  ADD COLUMN IF NOT EXISTS nasal_qty integer,
  ADD COLUMN IF NOT EXISTS warehouse_city text;
