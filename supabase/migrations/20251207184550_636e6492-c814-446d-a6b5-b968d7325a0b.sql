-- Create enums for roles and statuses
CREATE TYPE public.app_role AS ENUM ('pharmacy_admin', 'driver');
CREATE TYPE public.onboarding_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE public.timeline_status AS ENUM (
  'PENDING',
  'CONFIRMED', 
  'IN_ROUTE',
  'ARRIVED',
  'REQUEST_ADDRESS_REVIEW',
  'COMPLETED'
);
CREATE TYPE public.delivery_status AS ENUM (
  'SUCCESSFULLY_DELIVERED',
  'PACKAGE_DELIVERED_TO_CLIENT',
  'CLIENT_UNAVAILABLE',
  'NO_ONE_HOME',
  'WRONG_ADDRESS',
  'ADDRESS_INCORRECT',
  'SAFETY_CONCERN',
  'UNSAFE_LOCATION',
  'OTHER'
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  dob DATE,
  phone TEXT,
  avatar_url TEXT,
  onboarding_status public.onboarding_status DEFAULT 'not_started',
  agreement_terms BOOLEAN DEFAULT FALSE,
  agreement_privacy BOOLEAN DEFAULT FALSE,
  agreement_data_disclosure BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Toronto')
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source columns from import
  call_datetime TIMESTAMPTZ,
  billing_date DATE,
  ship_date DATE,
  doses_nasal INTEGER,
  nasal_rx TEXT,
  doses_injectable INTEGER,
  injection_rx TEXT,
  tracking_url_source TEXT,
  client_name TEXT,
  client_dob DATE,
  client_health_card TEXT,
  client_phone TEXT,
  client_email TEXT,
  client_call_notes TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Canada',
  province_1 TEXT,
  shipment_id TEXT UNIQUE,
  driver_id_import TEXT,
  authorizing_pharmacist TEXT,
  training_status TEXT,
  pharmacy_name TEXT,
  -- System fields
  assigned_driver_id UUID REFERENCES public.profiles(id),
  tracking_id TEXT UNIQUE,
  tracking_url TEXT,
  timeline_status public.timeline_status DEFAULT 'PENDING',
  delivery_status public.delivery_status,
  pending_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Toronto'),
  confirmed_at TIMESTAMPTZ,
  in_route_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  address_review_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Toronto'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Toronto')
);

-- Create public_tracking table (secure public entity)
CREATE TABLE public.public_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT UNIQUE NOT NULL,
  tracking_url TEXT,
  shipment_id TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.profiles(id),
  client_initials TEXT,
  doses_nasal INTEGER,
  nasal_rx TEXT,
  doses_injectable INTEGER,
  injection_rx TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Canada',
  timeline_status public.timeline_status DEFAULT 'PENDING',
  delivery_status public.delivery_status,
  pending_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  in_route_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  address_review_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Toronto'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'America/Toronto')
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_tracking ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW() AT TIME ZONE 'America/Toronto';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for timestamp updates
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_public_tracking_updated_at
  BEFORE UPDATE ON public.public_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'pharmacy_admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own role on signup"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'pharmacy_admin'));

-- Orders policies
CREATE POLICY "Admins can do everything with orders"
  ON public.orders FOR ALL
  USING (public.has_role(auth.uid(), 'pharmacy_admin'));

CREATE POLICY "Drivers can view their assigned orders"
  ON public.orders FOR SELECT
  USING (assigned_driver_id = auth.uid() AND public.has_role(auth.uid(), 'driver'));

CREATE POLICY "Drivers can update their assigned orders"
  ON public.orders FOR UPDATE
  USING (assigned_driver_id = auth.uid() AND public.has_role(auth.uid(), 'driver'));

-- Public tracking policies (publicly readable for tracking)
CREATE POLICY "Anyone can view tracking by tracking_id"
  ON public.public_tracking FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage public tracking"
  ON public.public_tracking FOR ALL
  USING (public.has_role(auth.uid(), 'pharmacy_admin'));

CREATE POLICY "Drivers can update their tracking entries"
  ON public.public_tracking FOR UPDATE
  USING (driver_id = auth.uid() AND public.has_role(auth.uid(), 'driver'));

-- Function to generate shipment ID
CREATE OR REPLACE FUNCTION public.generate_shipment_id()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  date_part TEXT;
  counter INTEGER;
BEGIN
  date_part := TO_CHAR(NOW() AT TIME ZONE 'America/Toronto', 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(shipment_id FROM 14) AS INTEGER)
  ), 0) + 1
  INTO counter
  FROM public.orders
  WHERE shipment_id LIKE 'TSCP-' || date_part || '-%';
  
  new_id := 'TSCP-' || date_part || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_id;
END;
$$;

-- Function to generate tracking ID
CREATE OR REPLACE FUNCTION public.generate_tracking_id()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$;

-- Function to get client initials
CREATE OR REPLACE FUNCTION public.get_client_initials(full_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parts TEXT[];
  initials TEXT := '';
BEGIN
  IF full_name IS NULL OR full_name = '' THEN
    RETURN '';
  END IF;
  
  parts := string_to_array(TRIM(full_name), ' ');
  
  FOR i IN 1..array_length(parts, 1) LOOP
    IF LENGTH(parts[i]) > 0 THEN
      initials := initials || UPPER(LEFT(parts[i], 1));
    END IF;
  END LOOP;
  
  RETURN initials;
END;
$$;