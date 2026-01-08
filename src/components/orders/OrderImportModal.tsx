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
        
        // Get raw data as array of arrays to preserve column positions
        const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
        
        if (rawData.length < 2) {
          setParsedData([]);
          return;
        }
        
        // First row is headers
        const headers = (rawData[0] as string[]).map(h => String(h || '').toLowerCase().trim());
        
        // Find column indices - handle duplicate column names by position
        const findColumnIndex = (name: string, startFrom = 0): number => {
          for (let i = startFrom; i < headers.length; i++) {
            if (headers[i] === name) return i;
          }
          return -1;
        };
        
        // Standard columns (unique)
        const colOrderDate = findColumnIndex('order date');
        const colClientName = findColumnIndex('client name');
        const colEmail = findColumnIndex('email');
        const colAddress1 = findColumnIndex('address line 1');
        const colAddress2 = findColumnIndex('address line 2');
        const colHealthCard = findColumnIndex('health card no.');
        const colNotes = findColumnIndex('notes');
        const colWarehouse = findColumnIndex('warehouse address');
        const colDoctor = findColumnIndex('authorizing doctor name');
        
        // Find injection section by NALOXONE-INJ Rx# column
        const colInjRx = headers.findIndex(h => h.includes('naloxone-inj'));
        
        // Find nasal section by NALOXONE-NASAL Rx# column  
        const colNasalRx = headers.findIndex(h => h.includes('naloxone-nasal'));
        
        // Injection columns (around injection rx#)
        // Expected order: Drug Type, Billing Date, NALOXONE-INJ Rx#, DIN, Drug Name, Strength, Form, Package, Qty
        const colInjBillingDate = colInjRx > 0 ? colInjRx - 1 : -1;
        const colInjDin = colInjRx >= 0 ? colInjRx + 1 : -1;
        const colInjDrugName = colInjRx >= 0 ? colInjRx + 2 : -1;
        const colInjStrength = colInjRx >= 0 ? colInjRx + 3 : -1;
        const colInjForm = colInjRx >= 0 ? colInjRx + 4 : -1;
        const colInjPackage = colInjRx >= 0 ? colInjRx + 5 : -1;
        const colInjQty = colInjRx >= 0 ? colInjRx + 6 : -1;
        
        // Nasal columns (around nasal rx#)
        // Expected order: Drug Type, Billing Date, NALOXONE-NASAL Rx#, DIN, Drug Name, Package, Qty
        const colNasalBillingDate = colNasalRx > 0 ? colNasalRx - 1 : -1;
        const colNasalDin = colNasalRx >= 0 ? colNasalRx + 1 : -1;
        const colNasalDrugName = colNasalRx >= 0 ? colNasalRx + 2 : -1;
        const colNasalPackage = colNasalRx >= 0 ? colNasalRx + 3 : -1;
        const colNasalQty = colNasalRx >= 0 ? colNasalRx + 4 : -1;
        
        // Parse data rows
        const mapped = rawData.slice(1).map((row: unknown[]) => {
          const getValue = (idx: number): string => idx >= 0 && idx < row.length ? String(row[idx] || '').trim() : '';
          const getNumber = (idx: number): number | undefined => {
            const val = getValue(idx);
            const num = Number(val);
            return !isNaN(num) && val !== '' ? num : undefined;
          };
          const getDate = (idx: number): string | null => {
            const val = getValue(idx);
            return parseDate(val);
          };
          
          const order: ParsedOrder = {
            // Customer & Order
            order_date: getDate(colOrderDate),
            client_name: getValue(colClientName) || undefined,
            email: getValue(colEmail) || undefined,
            health_card_no: getValue(colHealthCard) || undefined,
            notes: getValue(colNotes) || undefined,
            // Address
            address_line_1: getValue(colAddress1) || undefined,
            address_line_2: getValue(colAddress2) || undefined,
            warehouse_address: getValue(colWarehouse) || undefined,
            // Doctor
            authorizing_doctor_name: getValue(colDoctor) || undefined,
            // Injection data
            injection_rx_number: getValue(colInjRx) || undefined,
            injection_din: getValue(colInjDin) || undefined,
            injection_drug_name: getValue(colInjDrugName) || undefined,
            injection_strength: getValue(colInjStrength) || undefined,
            injection_form: getValue(colInjForm) || undefined,
            injection_package: getValue(colInjPackage) || undefined,
            injection_qty: getNumber(colInjQty),
            injection_billing_date: getDate(colInjBillingDate),
            // Nasal data
            nasal_rx_number: getValue(colNasalRx) || undefined,
            nasal_din: getValue(colNasalDin) || undefined,
            nasal_drug_name: getValue(colNasalDrugName) || undefined,
            nasal_package: getValue(colNasalPackage) || undefined,
            nasal_qty: getNumber(colNasalQty),
            nasal_billing_date: getDate(colNasalBillingDate),
          };
          
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

  // Geocode address using edge function
  const geocodeAddress = async (address: string): Promise<{ latitude: number | null; longitude: number | null; geo_zone: string | null; country: string | null }> => {
    try {
      if (!address || address.trim().length < 5) {
        return { latitude: null, longitude: null, geo_zone: null, country: null };
      }

      // Add Canada to address for better geocoding
      const fullAddress = address.includes('Canada') ? address : `${address}, Canada`;
      
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { address: fullAddress }
      });

      if (error || !data) {
        console.warn('Geocoding failed for address:', address, error);
        return { latitude: null, longitude: null, geo_zone: null, country: null };
      }

      return {
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        geo_zone: data.geo_zone || null,
        country: data.country || 'Canada'
      };
    } catch (error) {
      console.warn('Geocoding error:', error);
      return { latitude: null, longitude: null, geo_zone: null, country: null };
    }
  };

  const handleImport = async () => {
    const ordersToImport = getOrdersToImport();
    if (ordersToImport.length === 0) return;

    setIsImporting(true);
    let success = 0;
    let failed = 0;

    for (const order of ordersToImport) {
      try {
        // Generate shipment_id and tracking_id on import
        const { data: shipmentIdData } = await supabase.rpc('generate_shipment_id');
        const shipmentId = shipmentIdData as string;

        const { data: trackingIdData } = await supabase.rpc('generate_tracking_id');
        const trackingId = trackingIdData as string;

        const trackingUrl = `${window.location.origin}/track/${trackingId}`;

        // Get client initials
        const { data: initialsData } = await supabase.rpc('get_client_initials', {
          full_name: order.client_name || ''
        });
        const clientInitials = initialsData as string;

        // Geocode the address_line_1 to get lat/lng and geo_zone
        const geoData = await geocodeAddress(order.address_line_1 || '');

        // Extract city from warehouse address for public tracking
        const warehouseAddress = order.warehouse_address || '';
        const warehouseParts = warehouseAddress.split(',').map(p => p.trim());
        const warehouseCity = warehouseParts.length >= 2 ? warehouseParts[warehouseParts.length - 2] : warehouseParts[0] || null;

        const now = new Date().toISOString();
        
        // Insert order with tracking info
        const { data: insertedOrder, error: orderError } = await supabase.from('orders').insert({
          // Customer & Order
          order_date: order.order_date || null,
          client_name: order.client_name || '',
          email: order.email || '',
          health_card_no: order.health_card_no || '',
          notes: order.notes || '',
          // Address with geocoded data
          address_line_1: order.address_line_1 || '',
          address_line_2: order.address_line_2 || '',
          warehouse_address: order.warehouse_address || '',
          latitude: geoData.latitude,
          longitude: geoData.longitude,
          geo_zone: geoData.geo_zone,
          country: geoData.country,
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
          // System fields - set on import with tracking
          timeline_status: 'PENDING',
          assigned_driver_id: null,
          shipment_id: shipmentId,
          tracking_id: trackingId,
          tracking_url: trackingUrl,
          delivery_status: null,
          shipped_at: now,
        }).select('id').single();

        if (orderError) {
          console.error('Insert error:', orderError);
          failed++;
          continue;
        }

        // Create public tracking entry
        const { error: trackingError } = await supabase
          .from('public_tracking')
          .insert({
            tracking_id: trackingId,
            tracking_url: trackingUrl,
            shipment_id: shipmentId,
            order_id: insertedOrder.id,
            client_initials: clientInitials,
            injection_qty: order.injection_qty,
            nasal_qty: order.nasal_qty,
            warehouse_city: warehouseCity,
            country: geoData.country || 'Canada',
            latitude: geoData.latitude,
            longitude: geoData.longitude,
            geo_zone: geoData.geo_zone,
            timeline_status: 'PENDING',
            pending_at: now,
            shipped_at: now,
          });

        if (trackingError) {
          console.warn('Tracking insert error (order still created):', trackingError);
        }

        success++;
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
        description: `Successfully imported ${success} orders with tracking.${failed > 0 ? ` ${failed} failed.` : ''}`,
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
