import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrderImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedOrder {
  // Customer & Order
  order_date?: string | null;
  shipping_date?: string | null;
  client_name?: string;
  email?: string;
  health_card_no?: string;
  notes?: string;
  // Address
  address_line_1?: string;
  address_line_2?: string;
  warehouse_address?: string;
  // Doctor
  authorizing_doctor_name?: string;
  // Drug Data (Injection)
  injection_rx_number?: string;
  injection_din?: string;
  injection_drug_name?: string;
  injection_strength?: string;
  injection_form?: string;
  injection_package?: string;
  injection_qty?: number;
  injection_billing_date?: string | null;
  // Drug Data (Nasal)
  nasal_rx_number?: string;
  nasal_din?: string;
  nasal_drug_name?: string;
  nasal_package?: string;
  nasal_qty?: number;
  nasal_billing_date?: string | null;
}

// New CSV column headers mapping
const COLUMN_MAPPING: Record<string, keyof ParsedOrder> = {
  // Customer & Order
  'order date': 'order_date',
  'order_date': 'order_date',
  'shipping date': 'shipping_date',
  'shipping_date': 'shipping_date',
  'client name': 'client_name',
  'client_name': 'client_name',
  'email': 'email',
  'health card no.': 'health_card_no',
  'health card no': 'health_card_no',
  'health_card_no': 'health_card_no',
  'notes': 'notes',
  // Address
  'address line 1': 'address_line_1',
  'address_line_1': 'address_line_1',
  'address line 2': 'address_line_2',
  'address_line_2': 'address_line_2',
  'warehouse address': 'warehouse_address',
  'warehouse_address': 'warehouse_address',
  // Doctor
  'authorizing doctor name': 'authorizing_doctor_name',
  'authorizing_doctor_name': 'authorizing_doctor_name',
};

// Drug column prefixes for duplicate handling
const INJECTION_COLUMNS: Record<string, keyof ParsedOrder> = {
  'naloxone-inj rx#': 'injection_rx_number',
  'naloxone-inj rx': 'injection_rx_number',
};

const NASAL_COLUMNS: Record<string, keyof ParsedOrder> = {
  'naloxone-nasal rx#': 'nasal_rx_number',
  'naloxone-nasal rx': 'nasal_rx_number',
};

type ImportCount = 10 | 20 | 'all';

export function OrderImportModal({ isOpen, onClose, onSuccess }: OrderImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedOrder[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [selectedCount, setSelectedCount] = useState<ImportCount | null>(null);

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
        return dateVal.toISOString().split('T')[0]; // Return date only
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
          const headers = Object.keys(row);
          
          // Track which drug type section we're in
          let currentDrugType: 'injection' | 'nasal' | null = null;
          
          for (let i = 0; i < headers.length; i++) {
            const key = headers[i];
            const value = row[key];
            const normalizedKey = key.toLowerCase().trim();
            
            // Check if this is a Drug Type indicator
            if (normalizedKey === 'drug type') {
              const typeValue = String(value || '').toLowerCase();
              if (typeValue.includes('inj') || typeValue.includes('injection')) {
                currentDrugType = 'injection';
              } else if (typeValue.includes('nasal')) {
                currentDrugType = 'nasal';
              }
              continue;
            }
            
            // Map standard columns
            const mappedKey = COLUMN_MAPPING[normalizedKey];
            if (mappedKey) {
              if (mappedKey === 'order_date' || mappedKey === 'shipping_date') {
                order[mappedKey] = parseDate(value);
              } else {
                order[mappedKey] = String(value || '').trim() || undefined;
              }
              continue;
            }
            
            // Check for injection-specific columns
            if (INJECTION_COLUMNS[normalizedKey]) {
              order.injection_rx_number = String(value || '').trim() || undefined;
              continue;
            }
            
            // Check for nasal-specific columns
            if (NASAL_COLUMNS[normalizedKey]) {
              order.nasal_rx_number = String(value || '').trim() || undefined;
              continue;
            }
            
            // Handle drug-related columns based on context
            if (normalizedKey === 'billing date') {
              const dateValue = parseDate(value);
              if (currentDrugType === 'injection') {
                order.injection_billing_date = dateValue;
              } else if (currentDrugType === 'nasal') {
                order.nasal_billing_date = dateValue;
              }
              continue;
            }
            
            if (normalizedKey === 'din') {
              const dinValue = String(value || '').trim();
              if (currentDrugType === 'injection') {
                order.injection_din = dinValue;
              } else if (currentDrugType === 'nasal') {
                order.nasal_din = dinValue;
              }
              continue;
            }
            
            if (normalizedKey === 'drug name') {
              const nameValue = String(value || '').trim();
              if (currentDrugType === 'injection') {
                order.injection_drug_name = nameValue;
              } else if (currentDrugType === 'nasal') {
                order.nasal_drug_name = nameValue;
              }
              continue;
            }
            
            if (normalizedKey === 'strength') {
              if (currentDrugType === 'injection') {
                order.injection_strength = String(value || '').trim() || undefined;
              }
              continue;
            }
            
            if (normalizedKey === 'form') {
              if (currentDrugType === 'injection') {
                order.injection_form = String(value || '').trim() || undefined;
              }
              continue;
            }
            
            if (normalizedKey === 'package') {
              const packageValue = String(value || '').trim();
              if (currentDrugType === 'injection') {
                order.injection_package = packageValue;
              } else if (currentDrugType === 'nasal') {
                order.nasal_package = packageValue;
              }
              continue;
            }
            
            if (normalizedKey === 'qty') {
              const qtyValue = Number(value) || undefined;
              if (currentDrugType === 'injection') {
                order.injection_qty = qtyValue;
              } else if (currentDrugType === 'nasal') {
                order.nasal_qty = qtyValue;
              }
              continue;
            }
          }
          
          return order;
        });

        // Filter out completely empty orders
        const validOrders = mapped.filter(order => 
          order.client_name || order.address_line_1 || order.injection_rx_number || order.nasal_rx_number
        );
        
        setParsedData(validOrders);
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

  const getOrdersToImport = (): ParsedOrder[] => {
    if (!selectedCount || selectedCount === 'all') {
      return parsedData;
    }
    return parsedData.slice(0, selectedCount);
  };

  const handleImport = async () => {
    const ordersToImport = getOrdersToImport();
    if (ordersToImport.length === 0) return;

    setIsImporting(true);
    let success = 0;
    let failed = 0;

    for (const order of ordersToImport) {
      try {
        const { error } = await supabase.from('orders').insert({
          // Customer & Order
          order_date: order.order_date || null,
          shipping_date: order.shipping_date || null,
          client_name: order.client_name || '',
          email: order.email || '',
          health_card_no: order.health_card_no || '',
          notes: order.notes || '',
          // Address
          address_line_1: order.address_line_1 || '',
          address_line_2: order.address_line_2 || '',
          warehouse_address: order.warehouse_address || '',
          // Doctor
          authorizing_doctor_name: order.authorizing_doctor_name || '',
          // Drug Data (Injection)
          injection_rx_number: order.injection_rx_number || null,
          injection_din: order.injection_din || null,
          injection_drug_name: order.injection_drug_name || null,
          injection_strength: order.injection_strength || null,
          injection_form: order.injection_form || null,
          injection_package: order.injection_package || null,
          injection_qty: order.injection_qty || null,
          injection_billing_date: order.injection_billing_date || null,
          // Drug Data (Nasal)
          nasal_rx_number: order.nasal_rx_number || null,
          nasal_din: order.nasal_din || null,
          nasal_drug_name: order.nasal_drug_name || null,
          nasal_package: order.nasal_package || null,
          nasal_qty: order.nasal_qty || null,
          nasal_billing_date: order.nasal_billing_date || null,
          // System fields - set on import
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
    setSelectedCount(null);
    onClose();
  };

  const getImportCountLabel = (count: ImportCount): string => {
    if (count === 'all') return `All (${parsedData.length})`;
    return `First ${count}`;
  };

  const importOptions: ImportCount[] = [10, 20, 'all'];

  return (
    <Drawer open={isOpen} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Import Orders</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 overflow-y-auto">
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
                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setParsedData([]); setSelectedCount(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {parsedData.length > 0 && !importResult && (
                <>
                  {/* Import Count Selection */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">How many orders to import?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {importOptions.map((option) => {
                        const count = option === 'all' ? parsedData.length : option;
                        const isDisabled = option !== 'all' && parsedData.length < option;
                        
                        return (
                          <Button
                            key={option.toString()}
                            variant={selectedCount === option ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedCount(option)}
                            disabled={isDisabled}
                            className="w-full"
                          >
                            {getImportCountLabel(option)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left text-muted-foreground">#</th>
                          <th className="p-2 text-left text-muted-foreground">Client</th>
                          <th className="p-2 text-left text-muted-foreground">Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {getOrdersToImport().slice(0, 10).map((order, i) => (
                          <tr key={i}>
                            <td className="p-2 text-muted-foreground">{i + 1}</td>
                            <td className="p-2 text-foreground">{order.client_name || '-'}</td>
                            <td className="p-2 text-foreground">{order.address_line_1 || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {getOrdersToImport().length > 10 && (
                      <p className="p-2 text-xs text-muted-foreground text-center bg-muted">
                        + {getOrdersToImport().length - 10} more orders
                      </p>
                    )}
                  </div>
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
                </div>
              )}
            </div>
          )}
        </div>

        <DrawerFooter className="border-t border-border">
          {importResult ? (
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={handleImport}
              disabled={isImporting || !selectedCount || parsedData.length === 0}
            >
              {isImporting 
                ? 'Importing...' 
                : selectedCount 
                  ? `Import ${selectedCount === 'all' ? parsedData.length : Math.min(selectedCount, parsedData.length)} Orders`
                  : 'Select Import Count'
              }
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
