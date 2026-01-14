-- Fix custom_orders RLS policies to be PERMISSIVE instead of RESTRICTIVE
-- First drop all existing policies
DROP POLICY IF EXISTS "Admins can delete custom_orders" ON public.custom_orders;
DROP POLICY IF EXISTS "Admins can insert custom_orders" ON public.custom_orders;
DROP POLICY IF EXISTS "Admins can update custom_orders" ON public.custom_orders;
DROP POLICY IF EXISTS "Admins can view custom_orders" ON public.custom_orders;

-- Recreate as PERMISSIVE policies (the default, but explicit for clarity)
CREATE POLICY "Admins can view custom_orders" 
ON public.custom_orders 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can insert custom_orders" 
ON public.custom_orders 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can update custom_orders" 
ON public.custom_orders 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can delete custom_orders" 
ON public.custom_orders 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));