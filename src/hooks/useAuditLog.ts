import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

interface AuditLogData {
  orderId: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  deliveryStatus?: string;
  metadata?: Record<string, unknown>;
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

// Detect device type from user agent
function detectDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Tablet|iPad/i.test(ua)) return 'Tablet';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

// Detect browser type from user agent
function detectBrowserType(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edge')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Unknown';
}

export async function createAuditLog(data: AuditLogData): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const userAgent = navigator.userAgent;

    // Fetch user profile for full name, role, and driver_id
    let userFullName = 'Unknown User';
    let userRole = 'unknown';
    let driverId: string | null = null;
    
    if (userId) {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from('profiles').select('full_name, driver_id').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
      ]);
      
      if (profileResult.data?.full_name) {
        userFullName = profileResult.data.full_name;
      }
      if (profileResult.data?.driver_id) {
        driverId = profileResult.data.driver_id;
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
        // Updated fields
        user_role: userRole,
        user_full_name: userFullName,
        driver_id: driverId,
        session_id: getSessionId(),
        access_location: detectDeviceType(),
        consent_verified: true
      }]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating audit log:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Helper function to create audit log for order view
export async function logOrderView(orderId: string): Promise<void> {
  await createAuditLog({
    orderId,
    action: 'ORDER_VIEWED'
  });
}

// Helper function to create audit log for status change with internal event names
export async function logStatusChange(
  orderId: string, 
  previousStatus: string, 
  newStatus: string,
  deliveryStatus?: string
): Promise<void> {
  // Map to internal audit event names
  let action = 'STATUS_CHANGE';
  
  if (newStatus === 'PICKED_UP' && !previousStatus) {
    action = 'ORDER_ASSIGNED';
  } else if (newStatus === 'SHIPPED') {
    action = 'ORDER_SHIPPED';
  } else if (newStatus === 'DELIVERED') {
    action = 'DELIVERY_COMPLETED_SUCCESS';
  } else if (newStatus === 'DELIVERY_INCOMPLETE') {
    action = 'DELIVERY_COMPLETED_INCOMPLETE';
  }
  
  await createAuditLog({
    orderId,
    action,
    previousStatus,
    newStatus,
    deliveryStatus
  });
}

// Helper function for driver assignment audit
export async function logDriverAssignment(
  orderId: string,
  driverName: string
): Promise<void> {
  await createAuditLog({
    orderId,
    action: 'ORDER_ASSIGNED',
    newStatus: 'PICKED_UP',
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
