import { supabase } from '@/integrations/supabase/client';

interface DrugFieldSchema {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

/**
 * Builds a CSV header row + example row by combining active standard_fields
 * and active drug_types (their field_schema). Drug-type columns are prefixed
 * by the drug type display name, e.g. "Injection - Rx Number".
 */
export async function generateOrderImportTemplateCSV(): Promise<string> {
  const [stdRes, drugRes] = await Promise.all([
    supabase
      .from('standard_fields')
      .select('field_key, field_label, field_type, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('drug_types')
      .select('drug_type_key, display_name, field_schema, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const standard = stdRes.data ?? [];
  const drugs = drugRes.data ?? [];

  const headers: string[] = [];
  const example: string[] = [];

  for (const f of standard) {
    headers.push(f.field_label);
    example.push(sampleFor(f.field_key, f.field_type));
  }

  for (const d of drugs) {
    const schema = (d.field_schema as unknown as DrugFieldSchema[]) || [];
    for (const fld of schema) {
      headers.push(`${d.display_name} - ${fld.label}`);
      example.push(sampleFor(fld.key, fld.type));
    }
  }

  const escape = (v: string) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    headers.map(escape).join(','),
    example.map(escape).join(','),
  ].join('\n');

  // BOM for Excel UTF-8 compatibility
  return '\uFEFF' + csv;
}

function sampleFor(key: string, type: string): string {
  const k = key.toLowerCase();
  if (k.includes('email')) return 'client@example.com';
  if (k.includes('phone')) return '4165551234';
  if (k.includes('address_line_1')) return '123 Main St';
  if (k.includes('address_line_2')) return 'Suite 4';
  if (k.includes('warehouse')) return '500 Warehouse Rd, Toronto';
  if (k.includes('doctor')) return 'Dr. Jane Smith';
  if (k.includes('health_card')) return '1234-567-890-AB';
  if (k.includes('client_name')) return 'John Doe';
  if (k.includes('notes')) return 'Leave at door';
  if (k.includes('rx_number')) return 'RX1001';
  if (k === 'din' || k.endsWith('_din')) return '02451234';
  if (k.includes('drug_name')) return 'Sample Drug';
  if (k.includes('strength')) return '10mg';
  if (k.includes('form')) return 'Tablet';
  if (k.includes('package')) return 'Bottle';
  if (k.includes('includes')) return 'Naloxone, syringe, gloves';
  if (k.includes('type')) return 'Standard';
  if (k.includes('qty') || type === 'number') return '1';
  if (type === 'date' || k.includes('date')) return new Date().toISOString().slice(0, 10);
  return '';
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
