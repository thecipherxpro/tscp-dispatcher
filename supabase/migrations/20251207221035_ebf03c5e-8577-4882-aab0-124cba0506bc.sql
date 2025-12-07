-- Rename columns to match exact XLSX spec
ALTER TABLE public.orders RENAME COLUMN client_name TO name;
ALTER TABLE public.orders RENAME COLUMN client_dob TO dob;
ALTER TABLE public.orders RENAME COLUMN client_health_card TO health_card;
ALTER TABLE public.orders RENAME COLUMN client_phone TO phone_number;
ALTER TABLE public.orders RENAME COLUMN client_email TO email;
ALTER TABLE public.orders RENAME COLUMN client_call_notes TO call_notes;
ALTER TABLE public.orders RENAME COLUMN address_line1 TO address_1;
ALTER TABLE public.orders RENAME COLUMN address_line2 TO address_2;
ALTER TABLE public.orders RENAME COLUMN postal_code TO postal;

-- Add shipment_id_import column if it doesn't exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipment_id_import text;