-- Add driver_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS driver_id TEXT;

-- Create function to generate driver ID (D + 4 random digits)
CREATE OR REPLACE FUNCTION public.generate_driver_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  rand_digits TEXT;
BEGIN
  -- Generate 4 random digits
  rand_digits := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  new_id := 'D' || rand_digits;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE driver_id = new_id) LOOP
    rand_digits := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    new_id := 'D' || rand_digits;
  END LOOP;
  
  RETURN new_id;
END;
$$;

-- Create trigger function to auto-generate driver_id for new users
CREATE OR REPLACE FUNCTION public.handle_driver_id_generation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the user has a driver role
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.id AND role = 'driver'
  ) THEN
    -- Generate driver_id if not already set
    IF NEW.driver_id IS NULL THEN
      NEW.driver_id := public.generate_driver_id();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger that fires on profile updates to check for driver role
CREATE OR REPLACE TRIGGER check_driver_id_on_profile_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_driver_id_generation();

-- Also create a function to assign driver_id when role is assigned
CREATE OR REPLACE FUNCTION public.assign_driver_id_on_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'driver' THEN
    UPDATE public.profiles
    SET driver_id = public.generate_driver_id()
    WHERE id = NEW.user_id AND driver_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on user_roles to assign driver_id when driver role is created
CREATE OR REPLACE TRIGGER assign_driver_id_on_role_insert
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.assign_driver_id_on_role();

-- Add driver_id to audit logs table for tracking
ALTER TABLE public.order_audit_logs ADD COLUMN IF NOT EXISTS driver_id TEXT;

-- Generate driver IDs for existing drivers who don't have one
UPDATE public.profiles p
SET driver_id = public.generate_driver_id()
WHERE driver_id IS NULL
AND EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'driver'
);