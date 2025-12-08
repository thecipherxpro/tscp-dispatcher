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

export async function createAuditLog(data: AuditLogData): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const userAgent = navigator.userAgent;

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
        metadata: (data.metadata || {}) as Json
      }]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating audit log:', error);
    return { success: false, error: (error as Error).message };
  }
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