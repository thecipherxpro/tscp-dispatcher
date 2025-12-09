-- Add delivery route snapshot columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_route_snapshot_url TEXT,
ADD COLUMN IF NOT EXISTS delivery_route_snapshot_status TEXT DEFAULT NULL;

-- Add delivery route snapshot columns to public_tracking table
ALTER TABLE public.public_tracking 
ADD COLUMN IF NOT EXISTS delivery_route_snapshot_url TEXT,
ADD COLUMN IF NOT EXISTS delivery_route_snapshot_status TEXT DEFAULT NULL;

-- Add delivery route snapshot columns to order_audit_logs table
ALTER TABLE public.order_audit_logs 
ADD COLUMN IF NOT EXISTS delivery_route_snapshot_url TEXT;

-- Create storage bucket for route snapshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('route-snapshots', 'route-snapshots', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for route snapshots bucket
CREATE POLICY "Anyone can view route snapshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'route-snapshots');

CREATE POLICY "Authenticated users can upload route snapshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'route-snapshots' AND auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage route snapshots"
ON storage.objects FOR ALL
USING (bucket_id = 'route-snapshots');