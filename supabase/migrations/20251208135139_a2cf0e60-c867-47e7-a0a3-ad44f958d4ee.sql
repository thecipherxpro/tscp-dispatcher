-- Add PHIPA-compliant fields to order_audit_logs
ALTER TABLE public.order_audit_logs
ADD COLUMN IF NOT EXISTS phi_type TEXT,
ADD COLUMN IF NOT EXISTS phi_fields_accessed TEXT[],
ADD COLUMN IF NOT EXISTS access_purpose TEXT,
ADD COLUMN IF NOT EXISTS user_role TEXT,
ADD COLUMN IF NOT EXISTS user_full_name TEXT,
ADD COLUMN IF NOT EXISTS client_identifier TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS geolocation TEXT,
ADD COLUMN IF NOT EXISTS consent_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS access_location TEXT;

-- Add comment for PHIPA compliance documentation
COMMENT ON TABLE public.order_audit_logs IS 'PHIPA-compliant audit log for tracking all access to personal health information. Complies with Ontario PHIPA s. 10.1 requirements for electronic audit logs.';
COMMENT ON COLUMN public.order_audit_logs.phi_type IS 'Type of PHI accessed (e.g., demographic, clinical, medication, delivery)';
COMMENT ON COLUMN public.order_audit_logs.phi_fields_accessed IS 'Array of specific PHI fields that were accessed';
COMMENT ON COLUMN public.order_audit_logs.access_purpose IS 'Purpose for accessing the PHI (healthcare delivery, administration, etc.)';
COMMENT ON COLUMN public.order_audit_logs.user_role IS 'Role of the user accessing the PHI (pharmacy_admin, driver)';
COMMENT ON COLUMN public.order_audit_logs.user_full_name IS 'Full name of the person accessing the PHI';
COMMENT ON COLUMN public.order_audit_logs.client_identifier IS 'Identifier of the individual whose PHI was accessed (initials or masked ID)';
COMMENT ON COLUMN public.order_audit_logs.session_id IS 'Unique session identifier for tracking access sessions';
COMMENT ON COLUMN public.order_audit_logs.geolocation IS 'Geographic location of access if available';
COMMENT ON COLUMN public.order_audit_logs.consent_verified IS 'Whether consent was verified before access';
COMMENT ON COLUMN public.order_audit_logs.access_location IS 'Physical or logical location of access (office, mobile, etc.)';