-- Allow drivers to update their own audit logs (for location data)
CREATE POLICY "Drivers can update their order audit logs"
ON public.order_audit_logs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_audit_logs.order_id
    AND orders.assigned_driver_id = auth.uid()
  )
);