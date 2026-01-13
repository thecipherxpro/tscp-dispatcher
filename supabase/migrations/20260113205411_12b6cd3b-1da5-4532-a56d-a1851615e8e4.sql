-- Add NALOXONE KIT X4 drug type columns to orders table
ALTER TABLE public.orders
ADD COLUMN naloxone_kit_x4_drug_name text,
ADD COLUMN naloxone_kit_x4_qty integer,
ADD COLUMN naloxone_kit_x4_includes text,
ADD COLUMN naloxone_kit_x4_type text,
ADD COLUMN naloxone_kit_x4_billing_date date;

-- Add NALOXONE KIT X4 drug type columns to custom_orders table
ALTER TABLE public.custom_orders
ADD COLUMN naloxone_kit_x4_drug_name text,
ADD COLUMN naloxone_kit_x4_qty integer,
ADD COLUMN naloxone_kit_x4_includes text,
ADD COLUMN naloxone_kit_x4_type text,
ADD COLUMN naloxone_kit_x4_billing_date date;

-- Add quantity to public_tracking for display consistency
ALTER TABLE public.public_tracking
ADD COLUMN naloxone_kit_x4_qty integer;