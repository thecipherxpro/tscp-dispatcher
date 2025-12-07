import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrderImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedOrder {
  call_datetime?: string | null;
  billing_date?: string | null;
  ship_date?: string | null;
  doses_nasal?: number;
  nasal_rx?: string;
  doses_injectable?: number;
  injection_rx?: string;
  tracking_url_source?: string;
  name?: string;
  dob?: string | null;
  health_card?: string;
  phone_number?: string;
  email?: string;
  call_notes?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  province?: string;
  postal?: string;
  country?: string;
  shipment_id_import?: string;
  driver_id_import?: string;
  authorizing_pharmacist?: string;
  training_status?: string;
  pharmacy_name?: string;
}

// Exact XLSX column headers mapping
const COLUMN_MAPPING: Record<string, keyof ParsedOrder> = {
  'call date & time': 'call_datetime',
  'call_date_&_time': 'call_datetime',
  'billing date': 'billing_date',
  'billing_date': 'billing_date',
  'ship date': 'ship_date',
  'ship_date': 'ship_date',
  'doses nasal': 'doses_nasal',
  'doses_nasal': 'doses_nasal',
  'nasal rx': 'nasal_rx',
  'nasal_rx': 'nasal_rx',
  'doses injectable': 'doses_injectable',
  'doses_injectable': 'doses_injectable',
  'injection rx': 'injection_rx',
  'injection_rx': 'injection_rx',
  'tracking_url': 'tracking_url_source',
  'name': 'name',
  'dob': 'dob',
  'health card': 'health_card',
  'health_card': 'health_card',
  'phone number': 'phone_number',
  'phone_number': 'phone_number',
  'email': 'email',
  'call notes': 'call_notes',
  'call_notes': 'call_notes',
  'address 1': 'address_1',
  'address_1': 'address_1',
  'address 2': 'address_2',
  'address_2': 'address_2',
  'city': 'city',
  'province': 'province',
  'postal': 'postal',
  'country': 'country',
  'shipment id': 'shipment_id_import',
  'shipment_id': 'shipment_id_import',
  'driver id': 'driver_id_import',
  'driver_id': 'driver_id_import',
  'authorizing pharmacist': 'authorizing_pharmacist',
  'authorizing_pharmacist': 'authorizing_pharmacist',
  'training': 'training_status',
  'pharmacy': 'pharmacy_name',
};

export function OrderImportModal({ isOpen, onClose, onSuccess }: OrderImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedOrder[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseDate = (value: unknown): string | null => {
    if (!value) return null;
    try {
      const dateVal = value instanceof Date ? value : new Date(String(value));
      if (!isNaN(dateVal.getTime())) {
        return dateVal.toISOString();
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  };

  const parseFile = async (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        const mapped = jsonData.map((row: Record<string, unknown>) => {
          const order: ParsedOrder = {};
          
          Object.entries(row).forEach(([key, value]) => {
            const normalizedKey = key.toLowerCase().trim();
            const mappedKey = COLUMN_MAPPING[normalizedKey];
            
            if (mappedKey) {
              if (mappedKey === 'doses_nasal' || mappedKey === 'doses_injectable') {
                order[mappedKey] = Number(value) || 0;
              } else if (mappedKey === 'call_datetime' || mappedKey === 'billing_date' || mappedKey === 'ship_date' || mappedKey === 'dob') {
                order[mappedKey] = parseDate(value);
              } else {
                order[mappedKey] = String(value || '').trim();
              }
            }
          });
          
          return order;
        });

        // Never filter - insert ALL rows even if data is partial
        setParsedData(mapped);
      } catch (error) {
        console.error('Parse error:', error);
        toast({
          title: "Parse Error",
          description: "Failed to parse the file. Please check the format.",
          variant: "destructive",
        });
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setIsImporting(true);
    let success = 0;
    let failed = 0;

    for (const order of parsedData) {
      try {
        const { error } = await supabase.from('orders').insert({
          call_datetime: order.call_datetime || null,
          billing_date: order.billing_date || null,
          ship_date: order.ship_date || null,
          doses_nasal: order.doses_nasal || 0,
          nasal_rx: order.nasal_rx || '',
          doses_injectable: order.doses_injectable || 0,
          injection_rx: order.injection_rx || '',
          tracking_url_source: order.tracking_url_source || '',
          name: order.name || '',
          dob: order.dob || null,
          health_card: order.health_card || '',
          phone_number: order.phone_number || '',
          email: order.email || '',
          call_notes: order.call_notes || '',
          address_1: order.address_1 || '',
          address_2: order.address_2 || '',
          city: order.city || '',
          province: order.province || '',
          postal: order.postal || '',
          country: order.country || 'Canada',
          shipment_id_import: order.shipment_id_import || '',
          driver_id_import: order.driver_id_import || '',
          authorizing_pharmacist: order.authorizing_pharmacist || '',
          training_status: order.training_status || '',
          pharmacy_name: order.pharmacy_name || '',
          timeline_status: 'PENDING',
          assigned_driver_id: null,
          shipment_id: null,
          tracking_id: null,
          tracking_url: null,
          delivery_status: null,
        });

        if (error) {
          console.error('Insert error:', error);
          failed++;
        } else {
          success++;
        }
      } catch (error) {
        console.error('Import error:', error);
        failed++;
      }
    }

    setImportResult({ success, failed });
    setIsImporting(false);

    if (success > 0) {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${success} orders.${failed > 0 ? ` ${failed} failed.` : ''}`,
      });
      onSuccess();
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setImportResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Orders</DialogTitle>
        </DialogHeader>

        {!file ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="font-medium text-foreground mb-1">Upload File</p>
            <p className="text-sm text-muted-foreground">
              CSV or Excel (.xlsx, .xls)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileSpreadsheet className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {parsedData.length} orders found
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setParsedData([]); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {parsedData.length > 0 && !importResult && (
              <>
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left text-muted-foreground">Name</th>
                        <th className="p-2 text-left text-muted-foreground">City</th>
                        <th className="p-2 text-left text-muted-foreground">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedData.slice(0, 10).map((order, i) => (
                        <tr key={i}>
                          <td className="p-2 text-foreground">{order.name || '-'}</td>
                          <td className="p-2 text-foreground">{order.city || '-'}</td>
                          <td className="p-2 text-foreground">{order.phone_number || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedData.length > 10 && (
                    <p className="p-2 text-xs text-muted-foreground text-center bg-muted">
                      + {parsedData.length - 10} more orders
                    </p>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleImport}
                  disabled={isImporting}
                >
                  {isImporting ? 'Importing...' : `Import ${parsedData.length} Orders`}
                </Button>
              </>
            )}

            {importResult && (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium text-foreground">Import Complete</p>
                <p className="text-sm text-muted-foreground">
                  {importResult.success} imported
                  {importResult.failed > 0 && `, ${importResult.failed} failed`}
                </p>
                <Button className="mt-4" onClick={handleClose}>
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
