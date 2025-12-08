-- Create order_audit_logs table for tracking all order events
CREATE TABLE public.order_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  delivery_status TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Toronto')
);

-- Enable RLS
ALTER TABLE public.order_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.order_audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

-- Drivers can view audit logs for their assigned orders
CREATE POLICY "Drivers can view their order audit logs"
ON public.order_audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_audit_logs.order_id 
    AND orders.assigned_driver_id = auth.uid()
  )
);

-- Create policy for inserting audit logs (allows authenticated users)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.order_audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster order lookups
CREATE INDEX idx_order_audit_logs_order_id ON public.order_audit_logs(order_id);
CREATE INDEX idx_order_audit_logs_created_at ON public.order_audit_logs(created_at DESC);

-- Enable realtime for audit logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_audit_logs;