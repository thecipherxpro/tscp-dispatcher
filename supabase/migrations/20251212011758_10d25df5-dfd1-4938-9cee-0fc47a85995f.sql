-- Create a trigger function to auto-assign 'driver' role on user creation
CREATE OR REPLACE FUNCTION public.assign_default_role_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-assign 'driver' role to all new users
  -- Admin promotion must be done manually by existing admins
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'driver')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to auto-assign role
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_role_on_signup();

-- Drop the existing permissive INSERT policy that allows users to self-assign roles
DROP POLICY IF EXISTS "Users can insert their own role on signup" ON public.user_roles;

-- Create a new restrictive policy - only service role can insert (via trigger)
-- Users cannot directly insert roles
CREATE POLICY "Only triggers can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (false);

-- Note: The trigger runs as SECURITY DEFINER so it bypasses RLS