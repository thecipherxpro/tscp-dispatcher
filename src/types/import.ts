export interface DrugFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required: boolean;
  options?: string[];
}

export interface DrugType {
  id: string;
  drug_type_key: string;
  display_name: string;
  description: string | null;
  field_schema: DrugFieldSchema[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ColumnMapping {
  csv_column: string;
  field_key: string;
  field_label: string;
  drug_type_key?: string;
}

export interface ImportTemplate {
  id: string;
  template_name: string;
  description: string | null;
  column_mappings: ColumnMapping[];
  drug_type_mappings: any[];
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StandardField {
  key: string;
  label: string;
  type: string;
}

export const STANDARD_ORDER_FIELDS: StandardField[] = [
  { key: 'order_date', label: 'Order Date', type: 'date' },
  { key: 'shipping_date', label: 'Shipping Date', type: 'date' },
  { key: 'client_name', label: 'Client Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'address_line_1', label: 'Address Line 1', type: 'text' },
  { key: 'address_line_2', label: 'Address Line 2', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'postal_code', label: 'Postal Code', type: 'text' },
  { key: 'health_card_no', label: 'Health Card No.', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'text' },
  { key: 'warehouse_address', label: 'Warehouse Address', type: 'text' },
  { key: 'doctor_name', label: 'Doctor Name', type: 'text' },
];

// Extended column mapping with position-based detection for duplicate headers
export interface ExtendedColumnMapping extends ColumnMapping {
  drug_type_key?: string;
  position_anchor?: boolean;
  position_offset?: number;
}

// Drug type mapping for positional detection
export interface DrugTypeMapping {
  drug_type_key: string;
  anchor_column: string;
}

export const DEFAULT_DRUG_FIELDS: DrugFieldSchema[] = [
  { key: 'rx_number', label: 'Rx Number', type: 'text', required: true },
  { key: 'din', label: 'DIN', type: 'text', required: false },
  { key: 'drug_name', label: 'Drug Name', type: 'text', required: true },
  { key: 'strength', label: 'Strength', type: 'text', required: false },
  { key: 'qty', label: 'Quantity', type: 'number', required: true },
];

export interface ParsedFileColumn {
  name: string;
  sampleData: string;
}

export interface FileParseResult {
  columns: ParsedFileColumn[];
  rowCount: number;
  rawData: Record<string, any>[];
}
