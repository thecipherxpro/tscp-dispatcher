import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
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
  call_datetime?: string;
  billing_date?: string;
  ship_date?: string;
  doses_nasal?: number;
  nasal_rx?: string;
  doses_injectable?: number;
  injection_rx?: string;
  tracking_url_source?: string;
  client_name?: string;
  client_dob?: string;
  client_health_card?: string;
  client_phone?: string;
  client_email?: string;
  client_call_notes?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  province_1?: string;
  driver_id_import?: string;
  authorizing_pharmacist?: string;
  training_status?: string;
  pharmacy_name?: string;
}

const COLUMN_MAPPING: Record<string, keyof ParsedOrder> = {
  'call_datetime': 'call_datetime',
  'billing_date': 'billing_date',
  'ship_date': 'ship_date',
  'doses_nasal': 'doses_nasal',
  'nasal_rx': 'nasal_rx',
  'doses_injectable': 'doses_injectable',
  'injection_rx': 'injection_rx',
  'tracking_url': 'tracking_url_source',
  'tracking_url_source': 'tracking_url_source',
  'client_name': 'client_name',
  'name': 'client_name',
  'client_dob': 'client_dob',
  'dob': 'client_dob',
  'client_health_card': 'client_health_card',
  'health_card': 'client_health_card',
  'client_phone': 'client_phone',
  'phone': 'client_phone',
  'client_email': 'client_email',
  'email': 'client_email',
  'client_call_notes': 'client_call_notes',
  'call_notes': 'client_call_notes',
  'address_line1': 'address_line1',
  'address': 'address_line1',
  'address_line2': 'address_line2',
  'city': 'city',
  'province': 'province',
  'postal_code': 'postal_code',
  'postal': 'postal_code',
  'country': 'country',
  'province_1': 'province_1',
  'driver_id': 'driver_id_import',
  'driver_id_import': 'driver_id_import',
  'authorizing_pharmacist': 'authorizing_pharmacist',
  'pharmacist': 'authorizing_pharmacist',
  'training_status': 'training_status',
  'pharmacy_name': 'pharmacy_name',
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
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '_').trim();
            const mappedKey = COLUMN_MAPPING[normalizedKey];
            
            if (mappedKey && value !== undefined && value !== null && value !== '') {
              if (mappedKey === 'doses_nasal' || mappedKey === 'doses_injectable') {
                order[mappedKey] = parseInt(String(value), 10) || 0;
              } else if (mappedKey.includes('date') || mappedKey.includes('datetime')) {
                // Handle date parsing
                const dateVal = value instanceof Date ? value : new Date(String(value));
                if (!isNaN(dateVal.getTime())) {
                  order[mappedKey] = dateVal.toISOString().split('T')[0];
                }
              } else {
                order[mappedKey] = String(value).trim();
              }
            }
          });
          
          return order;
        });

        setParsedData(mapped.filter(o => o.client_name || o.address_line1));
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
          ...order,
          timeline_status: 'PENDING',
          country: order.country || 'Canada',
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
                        <th className="p-2 text-left text-muted-foreground">Client</th>
                        <th className="p-2 text-left text-muted-foreground">City</th>
                        <th className="p-2 text-left text-muted-foreground">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedData.slice(0, 10).map((order, i) => (
                        <tr key={i}>
                          <td className="p-2 text-foreground">{order.client_name || '-'}</td>
                          <td className="p-2 text-foreground">{order.city || '-'}</td>
                          <td className="p-2 text-foreground">{order.client_phone || '-'}</td>
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
