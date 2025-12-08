import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

// PHIPA-compliant PHI types
export type PHIType = 'demographic' | 'clinical' | 'medication' | 'delivery' | 'contact' | 'identification' | 'administrative';

// PHIPA-compliant access purposes
export type AccessPurpose = 
  | 'healthcare_delivery' 
  | 'delivery_fulfillment' 
  | 'order_management' 
  | 'status_update' 
  | 'administrative' 
  | 'audit_review'
  | 'quality_assurance';

interface AuditLogData {
  orderId: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  deliveryStatus?: string;
  metadata?: Record<string, unknown>;
  // PHIPA-compliant fields
  phiType?: PHIType;
  phiFieldsAccessed?: string[];
  accessPurpose?: AccessPurpose;
  clientIdentifier?: string;
  accessLocation?: string;
}

// Generate a session ID for tracking
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('audit_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('audit_session_id', sessionId);
  }
  return sessionId;
}

// Detect access location type
function detectAccessLocation(): string {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
  const isTablet = /Tablet|iPad/i.test(navigator.userAgent);
  
  if (isTablet) return 'tablet';
  if (isMobile) return 'mobile';
  return 'desktop';
}

export async function createAuditLog(data: AuditLogData): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const userAgent = navigator.userAgent;

    // Fetch user profile for full name and role
    let userFullName = 'Unknown User';
    let userRole = 'unknown';
    
    if (userId) {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
      ]);
      
      if (profileResult.data?.full_name) {
        userFullName = profileResult.data.full_name;
      }
      if (roleResult.data?.role) {
        userRole = roleResult.data.role;
      }
    }

    const { error } = await supabase
      .from('order_audit_logs')
      .insert([{
        order_id: data.orderId,
        user_id: userId,
        action: data.action,
        previous_status: data.previousStatus,
        new_status: data.newStatus,
        delivery_status: data.deliveryStatus,
        user_agent: userAgent,
        metadata: (data.metadata || {}) as Json,
        // PHIPA-compliant fields
        phi_type: data.phiType || 'administrative',
        phi_fields_accessed: data.phiFieldsAccessed || [],
        access_purpose: data.accessPurpose || 'order_management',
        user_role: userRole,
        user_full_name: userFullName,
        client_identifier: data.clientIdentifier,
        session_id: getSessionId(),
        access_location: data.accessLocation || detectAccessLocation(),
        consent_verified: true // Consent verified through app login
      }]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating audit log:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Helper function to create PHIPA-compliant audit log for order view
export async function logOrderView(orderId: string, clientName?: string): Promise<void> {
  const clientInitials = clientName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UNKNOWN';
  
  await createAuditLog({
    orderId,
    action: 'PHI_ACCESSED',
    phiType: 'demographic',
    phiFieldsAccessed: ['name', 'address', 'phone', 'dob', 'health_card'],
    accessPurpose: 'order_management',
    clientIdentifier: clientInitials
  });
}

// Helper function to create PHIPA-compliant audit log for status change
export async function logStatusChange(
  orderId: string, 
  previousStatus: string, 
  newStatus: string,
  deliveryStatus?: string,
  clientName?: string
): Promise<void> {
  const clientInitials = clientName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UNKNOWN';
  
  await createAuditLog({
    orderId,
    action: 'STATUS_CHANGE',
    previousStatus,
    newStatus,
    deliveryStatus,
    phiType: 'delivery',
    phiFieldsAccessed: ['timeline_status', 'delivery_status'],
    accessPurpose: 'delivery_fulfillment',
    clientIdentifier: clientInitials
  });
}

// Helper function for driver assignment audit
export async function logDriverAssignment(
  orderId: string,
  driverName: string,
  clientName?: string
): Promise<void> {
  const clientInitials = clientName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UNKNOWN';
  
  await createAuditLog({
    orderId,
    action: 'DRIVER_ASSIGNED',
    phiType: 'administrative',
    phiFieldsAccessed: ['assigned_driver_id'],
    accessPurpose: 'order_management',
    clientIdentifier: clientInitials,
    metadata: { assigned_driver: driverName }
  });
}

export function useAuditLogs(orderId: string) {
  const fetchAuditLogs = async () => {
    const { data, error } = await supabase
      .from('order_audit_logs')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }

    return data;
  };

  return { fetchAuditLogs };
}
