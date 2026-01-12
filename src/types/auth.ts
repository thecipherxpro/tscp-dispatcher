export type AppRole = 'pharmacy_admin' | 'driver';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';

// Timeline status enum - matches database
export type TimelineStatus = 
  | 'PENDING'
  | 'PICKED_UP_AND_ASSIGNED'
  | 'REVIEW_REQUESTED'
  | 'CONFIRMED'
  | 'IN_ROUTE'
  | 'COMPLETED_DELIVERED'
  | 'COMPLETED_INCOMPLETE';

// Internal audit events for detailed tracking
export type InternalAuditEvent = 
  | 'ORDER_IMPORTED'
  | 'ORDER_ASSIGNED'
  | 'REVIEW_REQUESTED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_SHIPPED'
  | 'DELIVERY_COMPLETED_SUCCESS'
  | 'DELIVERY_COMPLETED_INCOMPLETE';

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
  // Customer & Order fields
  order_date: string | null;
  shipping_date: string | null;
  client_name: string | null;
  phone: string | null;
  email: string | null;
  health_card_no: string | null;
  notes: string | null;
  // Address fields
  address_line_1: string | null;
  address_line_2: string | null;
  warehouse_address: string | null;
  // Doctor field
  authorizing_doctor_name: string | null;
  // Drug Data (Injection)
  injection_rx_number: string | null;
  injection_din: string | null;
  injection_drug_name: string | null;
  injection_strength: string | null;
  injection_form: string | null;
  injection_package: string | null;
  injection_qty: number | null;
  injection_billing_date: string | null;
  // Drug Data (Nasal)
  nasal_rx_number: string | null;
  nasal_din: string | null;
  nasal_drug_name: string | null;
  nasal_package: string | null;
  nasal_qty: number | null;
  nasal_billing_date: string | null;
  // Delivery system fields
  assigned_driver_id: string | null;
  tracking_id: string | null;
  tracking_url: string | null;
  shipment_id: string | null;
  timeline_status: TimelineStatus;
  delivery_status: DeliveryStatus | null;
  latitude: number | null;
  longitude: number | null;
  geo_zone: string | null;
  country: string | null;
  // Timestamps
  pending_at: string | null;
  picked_up_at: string | null;
  assigned_at: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  in_route_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  review_requested_at: string | null;
  review_reason: string | null;
  review_notes: string | null;
  address_review_requested_at: string | null;
  created_at: string;
  updated_at: string;
  // Route snapshot fields
  delivery_route_snapshot_url: string | null;
  delivery_route_snapshot_status: string | null;
}

export interface PublicTracking {
  id: string;
  tracking_id: string;
  tracking_url: string | null;
  shipment_id: string | null;
  order_id: string | null;
  driver_id: string | null;
  client_initials: string | null;
  // Drug quantities for public display
  injection_qty: number | null;
  nasal_qty: number | null;
  // Location - only warehouse city for privacy
  warehouse_city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_zone: string | null;
  timeline_status: TimelineStatus;
  delivery_status: DeliveryStatus | null;
  pending_at: string | null;
  picked_up_at: string | null;
  assigned_at: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  in_route_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  review_requested_at: string | null;
  review_reason: string | null;
  review_notes: string | null;
  address_review_requested_at: string | null;
  created_at: string;
  updated_at: string;
  // Route snapshot fields
  delivery_route_snapshot_url: string | null;
  delivery_route_snapshot_status: string | null;
}
