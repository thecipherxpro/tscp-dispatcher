-- Create drug_types table for configurable medication types
CREATE TABLE public.drug_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_type_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  field_schema jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drug_types ENABLE ROW LEVEL SECURITY;

-- Policies for drug_types
CREATE POLICY "Authenticated users can read drug_types"
  ON public.drug_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert drug_types"
  ON public.drug_types FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can update drug_types"
  ON public.drug_types FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can delete drug_types"
  ON public.drug_types FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

-- Create import_templates table for reusable CSV/Excel column mappings
CREATE TABLE public.import_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  description text,
  column_mappings jsonb NOT NULL DEFAULT '[]',
  drug_type_mappings jsonb NOT NULL DEFAULT '[]',
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;

-- Policies for import_templates
CREATE POLICY "Authenticated users can read import_templates"
  ON public.import_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert import_templates"
  ON public.import_templates FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can update import_templates"
  ON public.import_templates FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

CREATE POLICY "Admins can delete import_templates"
  ON public.import_templates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'pharmacy_admin'::app_role));

-- Insert default drug types with field schemas
INSERT INTO public.drug_types (drug_type_key, display_name, description, field_schema, sort_order) VALUES
(
  'injection',
  'Injection',
  'Injectable medications',
  '[
    {"key": "rx_number", "label": "Rx Number", "type": "text", "required": true},
    {"key": "din", "label": "DIN", "type": "text", "required": false},
    {"key": "drug_name", "label": "Drug Name", "type": "text", "required": true},
    {"key": "strength", "label": "Strength", "type": "text", "required": false},
    {"key": "form", "label": "Form", "type": "text", "required": false},
    {"key": "package", "label": "Package", "type": "text", "required": false},
    {"key": "qty", "label": "Quantity", "type": "number", "required": true},
    {"key": "billing_date", "label": "Billing Date", "type": "date", "required": false}
  ]'::jsonb,
  1
),
(
  'nasal',
  'Nasal',
  'Nasal spray medications',
  '[
    {"key": "rx_number", "label": "Rx Number", "type": "text", "required": true},
    {"key": "din", "label": "DIN", "type": "text", "required": false},
    {"key": "drug_name", "label": "Drug Name", "type": "text", "required": true},
    {"key": "package", "label": "Package", "type": "text", "required": false},
    {"key": "qty", "label": "Quantity", "type": "number", "required": true},
    {"key": "billing_date", "label": "Billing Date", "type": "date", "required": false}
  ]'::jsonb,
  2
),
(
  'oral',
  'Oral',
  'Oral medications (tablets, capsules)',
  '[
    {"key": "rx_number", "label": "Rx Number", "type": "text", "required": true},
    {"key": "din", "label": "DIN", "type": "text", "required": false},
    {"key": "drug_name", "label": "Drug Name", "type": "text", "required": true},
    {"key": "strength", "label": "Strength", "type": "text", "required": false},
    {"key": "qty", "label": "Quantity", "type": "number", "required": true},
    {"key": "billing_date", "label": "Billing Date", "type": "date", "required": false}
  ]'::jsonb,
  3
);

-- Create trigger for updated_at on drug_types
CREATE TRIGGER update_drug_types_updated_at
  BEFORE UPDATE ON public.drug_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on import_templates
CREATE TRIGGER update_import_templates_updated_at
  BEFORE UPDATE ON public.import_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();