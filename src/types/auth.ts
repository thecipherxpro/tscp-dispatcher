export type AppRole = 'pharmacy_admin' | 'driver';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';

export type TimelineStatus = 
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_ROUTE'
  | 'ARRIVED'
  | 'REQUEST_ADDRESS_REVIEW'
  | 'COMPLETED';

export type DeliveryStatus = 
  | 'SUCCESSFULLY_DELIVERED'
  | 'PACKAGE_DELIVERED_TO_CLIENT'
  | 'CLIENT_UNAVAILABLE'
  | 'NO_ONE_HOME'
  | 'WRONG_ADDRESS'
  | 'ADDRESS_INCORRECT'
  | 'SAFETY_CONCERN'
  | 'UNSAFE_LOCATION'
  | 'OTHER';

export interface Profile {
  id: string;
  full_name: string | null;
  dob: string | null;
  phone: string | null;
  avatar_url: string | null;
  driver_id: string | null;
  onboarding_status: OnboardingStatus;
  agreement_terms: boolean;
  agreement_privacy: boolean;
  agreement_data_disclosure: boolean;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Order {
  id: string;
  call_datetime: string | null;
  billing_date: string | null;
  ship_date: string | null;
  doses_nasal: number | null;
  nasal_rx: string | null;
  doses_injectable: number | null;
  injection_rx: string | null;
  tracking_url_source: string | null;
  name: string | null;
  dob: string | null;
  health_card: string | null;
  phone_number: string | null;
  email: string | null;
  call_notes: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  postal: string | null;
  country: string | null;
  province_1: string | null;
  shipment_id: string | null;
  shipment_id_import: string | null;
  driver_id_import: string | null;
  authorizing_pharmacist: string | null;
  training_status: string | null;
  pharmacy_name: string | null;
  assigned_driver_id: string | null;
  tracking_id: string | null;
  tracking_url: string | null;
  timeline_status: TimelineStatus;
  delivery_status: DeliveryStatus | null;
  pending_at: string | null;
  confirmed_at: string | null;
  in_route_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  address_review_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicTracking {
  id: string;
  tracking_id: string;
  tracking_url: string | null;
  shipment_id: string | null;
  order_id: string | null;
  driver_id: string | null;
  client_initials: string | null;
  doses_nasal: number | null;
  nasal_rx: string | null;
  doses_injectable: number | null;
  injection_rx: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  timeline_status: TimelineStatus;
  delivery_status: DeliveryStatus | null;
  pending_at: string | null;
  confirmed_at: string | null;
  in_route_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  address_review_requested_at: string | null;
  created_at: string;
  updated_at: string;
}
