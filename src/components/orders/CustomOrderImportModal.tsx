import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Star,
  AlertCircle,
  Loader2,
  Check
} from 'lucide-react';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerFooter 
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useImportTemplates } from '@/hooks/useImportTemplates';
import { ImportTemplate, STANDARD_ORDER_FIELDS } from '@/types/import';
import { useIsMobile } from '@/hooks/use-mobile';

interface CustomOrderImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'select-template' | 'upload-file' | 'review' | 'processing';

interface ParsedRow {
  [key: string]: any;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export function CustomOrderImportModal({ isOpen, onClose, onSuccess }: CustomOrderImportModalProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { templates, isLoading: templatesLoading, getDefaultTemplate } = useImportTemplates();
  
  const [step, setStep] = useState<Step>('select-template');
  const [selectedTemplate, setSelectedTemplate] = useState<ImportTemplate | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [mappedData, setMappedData] = useState<ParsedRow[]>([]);
  const [columnMatchInfo, setColumnMatchInfo] = useState<{ matched: number; total: number }>({ matched: 0, total: 0 });
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep('select-template');
      setSelectedTemplate(null);
      setFile(null);
      setParsedData([]);
      setMappedData([]);
      setColumnMatchInfo({ matched: 0, total: 0 });
      setImportProgress(0);
      setImportResult(null);
      onClose();
    }
  };

  const handleModalOpen = useCallback(() => {
    if (templates.length > 0 && !selectedTemplate) {
      const defaultTemplate = getDefaultTemplate();
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
    }
  }, [templates, selectedTemplate, getDefaultTemplate]);

  if (isOpen && !templatesLoading && templates.length > 0 && !selectedTemplate) {
    handleModalOpen();
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !selectedTemplate) return;

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
    parseFile(selectedFile, selectedTemplate);
  };

  const parseFile = (file: File, template: ImportTemplate) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true, cellNF: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const headers: string[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c });
          const cell = worksheet[cellAddress];
          headers.push(cell ? String(cell.v || '').trim() : '');
        }
        
        const rawDataWithArrays: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
          raw: false, 
          defval: '', 
          header: 1 
        });
        
        const dataRows = rawDataWithArrays.slice(1);
        
        if (dataRows.length === 0) {
          toast({
            title: "Empty file",
            description: "The file contains no data rows.",
            variant: "destructive",
          });
          return;
        }

        const anchorPositions: Record<string, number> = {};
        const drugTypeMappings = template.drug_type_mappings as any[];
        
        if (drugTypeMappings && drugTypeMappings.length > 0) {
          drugTypeMappings.forEach((dtm: any) => {
            const anchorIndex = headers.findIndex(h => 
              h.toLowerCase() === dtm.anchor_column.toLowerCase()
            );
            if (anchorIndex !== -1) {
              anchorPositions[dtm.drug_type_key] = anchorIndex;
            }
          });
        }

        const mappings = template.column_mappings as any[];
        let matchedCount = 0;
        
        mappings.forEach((mapping: any) => {
          if (mapping.position_anchor || mapping.position_offset !== undefined) {
            const drugKey = mapping.drug_type_key;
            if (drugKey && anchorPositions[drugKey] !== undefined) {
              const targetIndex = mapping.position_anchor 
                ? anchorPositions[drugKey]
                : anchorPositions[drugKey] + (mapping.position_offset || 0);
              if (targetIndex >= 0 && targetIndex < headers.length) {
                matchedCount++;
              }
            }
          } else {
            if (headers.some(h => h.toLowerCase() === mapping.csv_column.toLowerCase())) {
              matchedCount++;
            }
          }
        });
        
        setColumnMatchInfo({
          matched: matchedCount,
          total: mappings.length
        });
        
        const transformed = dataRows.map((row: any[]) => {
          const mappedRow: ParsedRow = {};
          
          mappings.forEach((mapping: any) => {
            let value: any;
            
            if (mapping.position_anchor) {
              const drugKey = mapping.drug_type_key;
              const anchorIndex = anchorPositions[drugKey];
              if (anchorIndex !== undefined && anchorIndex < row.length) {
                value = row[anchorIndex];
              }
            } else if (mapping.position_offset !== undefined && mapping.drug_type_key) {
              const drugKey = mapping.drug_type_key;
              const anchorIndex = anchorPositions[drugKey];
              if (anchorIndex !== undefined) {
                const targetIndex = anchorIndex + mapping.position_offset;
                if (targetIndex >= 0 && targetIndex < row.length) {
                  value = row[targetIndex];
                }
              }
            } else {
              const columnIndex = headers.findIndex(h => 
                h.toLowerCase() === mapping.csv_column.toLowerCase()
              );
              if (columnIndex !== -1 && columnIndex < row.length) {
                value = row[columnIndex];
              }
            }
            
            if (value !== undefined && value !== '') {
              mappedRow[mapping.field_key] = value;
            }
          });
          
          return mappedRow;
        });
        
        const validRows = transformed.filter(row => 
          Object.values(row).some(v => v !== '' && v !== undefined && v !== null)
        );
        
        const rawDataAsObjects = dataRows.map((row: any[]) => {
          const obj: ParsedRow = {};
          headers.forEach((h, i) => {
            if (h && row[i] !== undefined) {
              obj[h] = row[i];
            }
          });
          return obj;
        });
        
        setParsedData(rawDataAsObjects);
        setMappedData(validRows);
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

  const geocodeAddress = async (address: string) => {
    try {
      if (!address || address.trim().length < 5) {
        return { latitude: null, longitude: null, geo_zone: null, country: null };
      }

      const fullAddress = address.includes('Canada') ? address : `${address}, Canada`;
      
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { address: fullAddress }
      });

      if (error || !data) {
        return { latitude: null, longitude: null, geo_zone: null, country: null };
      }

      return {
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        geo_zone: data.geo_zone || null,
        country: data.country || 'Canada'
      };
    } catch {
      return { latitude: null, longitude: null, geo_zone: null, country: null };
    }
  };

  const handleImport = async () => {
    if (mappedData.length === 0) return;

    setStep('processing');
    setIsImporting(true);
    
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Pre-generate all shipment IDs and tracking IDs BEFORE insertion to ensure uniqueness
    // NOTE: The backend generate_shipment_id() function is for the main orders flow and may
    // return the same value for custom_orders. So we generate a unique TSCP shipment_id here.
    const generatedIds: Array<{ shipmentId: string; trackingId: string }> = [];

    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const shipmentPrefix = `TSCP${yy}${mm}${dd}`;

    // Try to continue the counter from the latest custom_orders shipment_id for today.
    // If we can't read it (RLS/network), fall back to a time-based counter.
    let startCounter = (Date.now() % 10000); // 0-9999
    try {
      const { data: latestToday, error: latestErr } = await supabase
        .from('custom_orders')
        .select('shipment_id, created_at')
        .like('shipment_id', `${shipmentPrefix}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!latestErr) {
        const last = latestToday?.[0]?.shipment_id;
        if (last && last.startsWith(shipmentPrefix)) {
          const suffix = Number(last.slice(shipmentPrefix.length));
          if (!Number.isNaN(suffix) && suffix >= 0) {
            startCounter = (suffix + 1) % 10000;
          }
        }
      }
    } catch {
      // ignore and use fallback
    }

    for (let i = 0; i < mappedData.length; i++) {
      // Keep within 4 digits while staying unique inside the batch
      const counter = (startCounter + i) % 10000;
      const suffix4 = String(counter).padStart(4, '0');
      const shipmentId = `${shipmentPrefix}${suffix4}`;

      try {
        // Tracking IDs are generated from the backend and are already unique
        const { data: trackingIdData } = await supabase.rpc('generate_tracking_id');
        const trackingId = trackingIdData as string;
        generatedIds.push({ shipmentId, trackingId });
      } catch {
        const fallbackTracking = `${Math.random().toString(36).substring(2, 5).toUpperCase()}T${i.toString().padStart(2, '0')}SCP`;
        generatedIds.push({ shipmentId, trackingId: fallbackTracking });
      }

      setImportProgress(Math.round(((i + 1) / mappedData.length) * 30)); // First 30% is ID generation
    }

    // Now insert orders with pre-generated IDs
    for (let i = 0; i < mappedData.length; i++) {
      const row = mappedData[i];
      const { shipmentId, trackingId } = generatedIds[i];
      setImportProgress(30 + Math.round(((i + 1) / mappedData.length) * 70)); // 30-100% is insertion
      
      try {
        const trackingUrl = `${window.location.origin}/track/${trackingId}`;
        
        // Geocode address
        const geoData = await geocodeAddress(row.address_line_1 || '');

        // Build custom order data
        const orderData: any = {
          shipment_id: shipmentId,
          tracking_id: trackingId,
          tracking_url: trackingUrl,
          latitude: geoData.latitude,
          longitude: geoData.longitude,
          geo_zone: geoData.geo_zone,
          country: geoData.country,
        };
        
        // Map standard fields
        STANDARD_ORDER_FIELDS.forEach(field => {
          if (row[field.key] !== undefined) {
            orderData[field.key] = row[field.key];
          }
        });
        
        // Map drug type fields
        Object.entries(row).forEach(([key, value]) => {
          if (key.includes('_') && value !== undefined && value !== '') {
            // Map phone_number to phone (database column name)
            if (key === 'phone_number') {
              orderData['phone'] = value;
            } else {
              orderData[key] = value;
            }
          }
        });
        
        // Also check for phone_number at top level (not prefixed)
        if (row['phone_number'] !== undefined && row['phone_number'] !== '') {
          orderData['phone'] = row['phone_number'];
        }
        if (row['phone'] !== undefined && row['phone'] !== '') {
          orderData['phone'] = row['phone'];
        }
        
        // Parse dates
        if (orderData.order_date) {
          try {
            const d = new Date(orderData.order_date);
            orderData.order_date = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
          } catch {
            orderData.order_date = null;
          }
        }
        
        // Parse quantities for all drug types
        ['injection_qty', 'nasal_qty', 'oral_qty', 'naloxone_kit_x4_qty'].forEach(qtyField => {
          if (orderData[qtyField]) {
            const num = Number(orderData[qtyField]);
            orderData[qtyField] = !isNaN(num) ? num : null;
          }
        });

        // Insert into custom_orders (NOT orders or public_tracking)
        const { error: orderError } = await supabase
          .from('custom_orders')
          .insert(orderData);

        if (orderError) {
          failed++;
          errors.push(`Row ${i + 1}: ${orderError.message}`);
          continue;
        }

        success++;
      } catch (error: any) {
        failed++;
        errors.push(`Row ${i + 1}: ${error.message || 'Unknown error'}`);
      }
    }

    setIsImporting(false);
    setImportResult({ success, failed, errors });

    if (success > 0) {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${success} custom orders.${failed > 0 ? ` ${failed} failed.` : ''}`,
      });
    }
  };

  const handleDone = () => {
    handleOpenChange(false);
    if (importResult && importResult.success > 0) {
      onSuccess();
    }
  };

  const canProceedFromTemplate = !!selectedTemplate;
  const canProceedFromUpload = file && mappedData.length > 0;

  const getPreviewColumns = (): string[] => {
    if (!selectedTemplate || mappedData.length === 0) return [];
    const firstRow = mappedData[0];
    return Object.keys(firstRow).slice(0, 5);
  };

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b border-border pb-4">
          <DrawerTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import Custom Orders
            {step !== 'select-template' && (
              <Badge variant="outline" className="ml-2">
                {step === 'upload-file' ? 'Step 2' : step === 'review' ? 'Step 3' : 'Importing'}
              </Badge>
            )}
          </DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="p-4">
            {/* Step 1: Select Template */}
            {step === 'select-template' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-foreground mb-1">Choose Import Template</h3>
                  <p className="text-sm text-muted-foreground">
                    Select a template to map your CSV columns
                  </p>
                </div>

                {templatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : templates.length === 0 ? (
                  <Card className="bg-card border-border">
                    <CardContent className="p-6 text-center">
                      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="font-medium text-foreground">No templates available</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create an import template first in Settings → Import Templates
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <Card
                        key={template.id}
                        className={`cursor-pointer transition-all ${
                          selectedTemplate?.id === template.id
                            ? 'ring-2 ring-primary border-primary'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {template.template_name}
                                </span>
                                {template.is_default && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Star className="w-3 h-3 mr-1" />
                                    Default
                                  </Badge>
                                )}
                              </div>
                              {template.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {template.description}
                                </p>
                              )}
                            </div>
                            {selectedTemplate?.id === template.id && (
                              <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Upload File */}
            {step === 'upload-file' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-foreground mb-1">Upload File</h3>
                  <p className="text-sm text-muted-foreground">
                    Using template: <span className="font-medium">{selectedTemplate?.template_name}</span>
                  </p>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {file ? (
                    <div className="space-y-2">
                      <CheckCircle className="w-10 h-10 mx-auto text-primary" />
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {mappedData.length} rows ready to import
                      </p>
                      <Badge variant="outline">
                        {columnMatchInfo.matched}/{columnMatchInfo.total} columns matched
                      </Badge>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                      <p className="font-medium text-foreground">Click to upload</p>
                      <p className="text-sm text-muted-foreground">CSV or Excel files</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-foreground mb-1">Review Import</h3>
                  <p className="text-sm text-muted-foreground">
                    {mappedData.length} orders will be imported to Custom Orders
                  </p>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        {getPreviewColumns().map((col) => (
                          <TableHead key={col} className="min-w-[100px]">
                            {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedData.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                          {getPreviewColumns().map((col) => (
                            <TableCell key={col} className="text-sm truncate max-w-[150px]">
                              {row[col] || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {mappedData.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Showing 5 of {mappedData.length} rows
                  </p>
                )}
              </div>
            )}

            {/* Step 4: Processing */}
            {step === 'processing' && (
              <div className="space-y-6 py-4">
                {isImporting ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground">Importing orders...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Please wait while we process your file
                      </p>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                    <p className="text-center text-sm text-muted-foreground">
                      {importProgress}% complete
                    </p>
                  </div>
                ) : importResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="w-8 h-8 text-primary" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground text-lg">Import Complete</p>
                      <p className="text-muted-foreground mt-1">
                        {importResult.success} orders imported successfully
                      </p>
                      {importResult.failed > 0 && (
                        <p className="text-destructive mt-1">
                          {importResult.failed} orders failed
                        </p>
                      )}
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="bg-destructive/10 rounded-lg p-3 max-h-32 overflow-y-auto">
                        <p className="text-sm font-medium text-destructive mb-2">Errors:</p>
                        {importResult.errors.slice(0, 5).map((error, idx) => (
                          <p key={idx} className="text-xs text-destructive">
                            {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </ScrollArea>

        <DrawerFooter className="border-t border-border pt-4">
          {step === 'select-template' && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => handleOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={() => setStep('upload-file')}
                disabled={!canProceedFromTemplate}
                className="flex-1"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 'upload-file' && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setStep('select-template')} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep('review')}
                disabled={!canProceedFromUpload}
                className="flex-1"
              >
                Review
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 'review' && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setStep('upload-file')} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleImport} className="flex-1">
                Import {mappedData.length} Orders
              </Button>
            </div>
          )}

          {step === 'processing' && !isImporting && importResult && (
            <Button onClick={handleDone} className="w-full">
              Done
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
