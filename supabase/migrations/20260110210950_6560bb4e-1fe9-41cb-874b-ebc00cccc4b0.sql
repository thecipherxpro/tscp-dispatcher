-- Insert the Naloxone Kit Template as the default template
INSERT INTO import_templates (
  template_name,
  description,
  column_mappings,
  drug_type_mappings,
  is_default,
  created_by
) VALUES (
  'Naloxone Kit Template',
  'Standard import template for Naloxone injection and nasal spray kits. Maps Order Date, Client Name, Address, Health Card, Warehouse, Doctor, and drug-specific fields for both Injection and Nasal medications.',
  '[
    {"csv_column": "Order Date", "field_key": "order_date", "field_label": "Order Date"},
    {"csv_column": "Shipping Date", "field_key": "shipping_date", "field_label": "Shipping Date"},
    {"csv_column": "Client Name", "field_key": "client_name", "field_label": "Client Name"},
    {"csv_column": "Email", "field_key": "email", "field_label": "Email"},
    {"csv_column": "Address Line 1", "field_key": "address_line_1", "field_label": "Address Line 1"},
    {"csv_column": "Address Line 2", "field_key": "address_line_2", "field_label": "Address Line 2"},
    {"csv_column": "Health Card No.", "field_key": "health_card_no", "field_label": "Health Card No."},
    {"csv_column": "Notes", "field_key": "notes", "field_label": "Notes"},
    {"csv_column": "Warehouse Address", "field_key": "warehouse_address", "field_label": "Warehouse Address"},
    {"csv_column": "Authorizing Doctor Name", "field_key": "doctor_name", "field_label": "Doctor Name"},
    {"csv_column": "NALOXONE-INJ Rx#", "field_key": "injection_rx_number", "field_label": "Injection Rx Number", "drug_type_key": "injection", "position_anchor": true},
    {"csv_column": "DIN", "field_key": "injection_din", "field_label": "Injection DIN", "drug_type_key": "injection", "position_offset": 1},
    {"csv_column": "Drug Name", "field_key": "injection_drug_name", "field_label": "Injection Drug Name", "drug_type_key": "injection", "position_offset": 2},
    {"csv_column": "Strength", "field_key": "injection_strength", "field_label": "Injection Strength", "drug_type_key": "injection", "position_offset": 3},
    {"csv_column": "Form", "field_key": "injection_form", "field_label": "Injection Form", "drug_type_key": "injection", "position_offset": 4},
    {"csv_column": "Package", "field_key": "injection_package", "field_label": "Injection Package", "drug_type_key": "injection", "position_offset": 5},
    {"csv_column": "Qty", "field_key": "injection_qty", "field_label": "Injection Qty", "drug_type_key": "injection", "position_offset": 6},
    {"csv_column": "Billing Date", "field_key": "injection_billing_date", "field_label": "Injection Billing Date", "drug_type_key": "injection", "position_offset": 7},
    {"csv_column": "NALOXONE-NASAL Rx#", "field_key": "nasal_rx_number", "field_label": "Nasal Rx Number", "drug_type_key": "nasal", "position_anchor": true},
    {"csv_column": "DIN", "field_key": "nasal_din", "field_label": "Nasal DIN", "drug_type_key": "nasal", "position_offset": 1},
    {"csv_column": "Drug Name", "field_key": "nasal_drug_name", "field_label": "Nasal Drug Name", "drug_type_key": "nasal", "position_offset": 2},
    {"csv_column": "Package", "field_key": "nasal_package", "field_label": "Nasal Package", "drug_type_key": "nasal", "position_offset": 3},
    {"csv_column": "Qty", "field_key": "nasal_qty", "field_label": "Nasal Qty", "drug_type_key": "nasal", "position_offset": 4},
    {"csv_column": "Billing Date", "field_key": "nasal_billing_date", "field_label": "Nasal Billing Date", "drug_type_key": "nasal", "position_offset": 5}
  ]'::jsonb,
  '[
    {"drug_type_key": "injection", "anchor_column": "NALOXONE-INJ Rx#"},
    {"drug_type_key": "nasal", "anchor_column": "NALOXONE-NASAL Rx#"}
  ]'::jsonb,
  true,
  NULL
);