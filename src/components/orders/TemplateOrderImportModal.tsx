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
import { ImportTemplate, ColumnMapping, STANDARD_ORDER_FIELDS } from '@/types/import';
import { useIsMobile } from '@/hooks/use-mobile';

interface TemplateOrderImportModalProps {
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

export function TemplateOrderImportModal({ isOpen, onClose, onSuccess }: TemplateOrderImportModalProps) {
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

  // Reset state when modal opens
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

  // Auto-select default template on open
  const handleModalOpen = useCallback(() => {
    if (templates.length > 0 && !selectedTemplate) {
      const defaultTemplate = getDefaultTemplate();
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
    }
  }, [templates, selectedTemplate, getDefaultTemplate]);

  // Call on open
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
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData: ParsedRow[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
        
        if (rawData.length === 0) {
          toast({
            title: "Empty file",
            description: "The file contains no data rows.",
            variant: "destructive",
          });
          return;
        }

        setParsedData(rawData);
        
        // Map columns based on template
        const headers = Object.keys(rawData[0]);
        const matchedColumns = template.column_mappings.filter(m => 
          headers.some(h => h.toLowerCase() === m.csv_column.toLowerCase())
        );
        
        setColumnMatchInfo({
          matched: matchedColumns.length,
          total: template.column_mappings.length
        });
        
        // Transform data according to mappings
        const transformed = rawData.map(row => {
          const mappedRow: ParsedRow = {};
          
          template.column_mappings.forEach(mapping => {
            const csvValue = Object.entries(row).find(
              ([key]) => key.toLowerCase() === mapping.csv_column.toLowerCase()
            )?.[1];
            
            if (csvValue !== undefined && csvValue !== '') {
              mappedRow[mapping.field_key] = csvValue;
            }
          });
          
          return mappedRow;
        });
        
        // Filter out empty rows
        const validRows = transformed.filter(row => 
          Object.values(row).some(v => v !== '' && v !== undefined && v !== null)
        );
        
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

    for (let i = 0; i < mappedData.length; i++) {
      const row = mappedData[i];
      setImportProgress(Math.round(((i + 1) / mappedData.length) * 100));
      
      try {
        // Generate IDs
        const { data: shipmentIdData } = await supabase.rpc('generate_shipment_id');
        const shipmentId = shipmentIdData as string;
        const { data: trackingIdData } = await supabase.rpc('generate_tracking_id');
        const trackingId = trackingIdData as string;
        const trackingUrl = `${window.location.origin}/track/${trackingId}`;
        
        // Get client initials
        const { data: initialsData } = await supabase.rpc('get_client_initials', {
          full_name: row.client_name || ''
        });
        const clientInitials = initialsData as string;
        
        // Geocode address
        const geoData = await geocodeAddress(row.address_line_1 || '');
        
        // Extract warehouse city
        const warehouseAddress = row.warehouse_address || '';
        const warehouseParts = warehouseAddress.split(',').map((p: string) => p.trim());
        const warehouseCity = warehouseParts.length >= 2 
          ? warehouseParts[warehouseParts.length - 2] 
          : warehouseParts[0] || null;

        const now = new Date().toISOString();
        
        // Build order data from mapped fields
        // Note: shipped_at is NOT set on import - it's only set when driver starts transit
        const orderData: any = {
          timeline_status: 'PENDING',
          pending_at: now,
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
        
        // Map drug type fields (injection_, nasal_, oral_, etc.)
        Object.entries(row).forEach(([key, value]) => {
          if (key.includes('_') && value !== undefined && value !== '') {
            // Handle drug type prefixed fields
            orderData[key] = value;
          }
        });
        
        // Parse dates
        if (orderData.order_date) {
          try {
            const d = new Date(orderData.order_date);
            orderData.order_date = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
          } catch {
            orderData.order_date = null;
          }
        }
        
        // Parse quantities
        ['injection_qty', 'nasal_qty', 'oral_qty'].forEach(qtyField => {
          if (orderData[qtyField]) {
            const num = Number(orderData[qtyField]);
            orderData[qtyField] = !isNaN(num) ? num : null;
          }
        });

        const { data: insertedOrder, error: orderError } = await supabase
          .from('orders')
          .insert(orderData)
          .select('id')
          .single();

        if (orderError) {
          failed++;
          errors.push(`Row ${i + 1}: ${orderError.message}`);
          continue;
        }

        // Create public tracking
        // Note: shipped_at is NOT set on import - only when driver starts transit
        await supabase.from('public_tracking').insert({
          tracking_id: trackingId,
          tracking_url: trackingUrl,
          shipment_id: shipmentId,
          order_id: insertedOrder.id,
          client_initials: clientInitials,
          injection_qty: orderData.injection_qty || null,
          nasal_qty: orderData.nasal_qty || null,
          warehouse_city: warehouseCity,
          country: geoData.country || 'Canada',
          latitude: geoData.latitude,
          longitude: geoData.longitude,
          geo_zone: geoData.geo_zone,
          timeline_status: 'PENDING',
          pending_at: now,
        });

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
        description: `Successfully imported ${success} orders.${failed > 0 ? ` ${failed} failed.` : ''}`,
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

  // Get preview columns for display
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
            Import Orders
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
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              selectedTemplate?.id === template.id
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground'
                            }`}>
                              {selectedTemplate?.id === template.id && (
                                <Check className="w-3 h-3 text-primary-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground truncate">
                                  {template.template_name}
                                </span>
                                {template.is_default && (
                                  <Badge variant="secondary" className="gap-1 flex-shrink-0">
                                    <Star className="w-3 h-3 fill-current" />
                                    Default
                                  </Badge>
                                )}
                              </div>
                              {template.description && (
                                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                                  {template.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {template.column_mappings.length} columns mapped
                              </p>
                            </div>
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
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Using: {selectedTemplate?.template_name}
                  </span>
                </div>

                {!file ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
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
                    <Card className="bg-card border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <FileSpreadsheet className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{file.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {mappedData.length} rows detected
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFile(null);
                              setParsedData([]);
                              setMappedData([]);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                          >
                            Change
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Column Match Summary */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <CheckCircle className={`w-5 h-5 ${
                        columnMatchInfo.matched === columnMatchInfo.total 
                          ? 'text-green-500' 
                          : 'text-yellow-500'
                      }`} />
                      <span className="text-sm text-foreground">
                        {columnMatchInfo.matched}/{columnMatchInfo.total} template columns matched
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">Review Import</h3>
                    <p className="text-sm text-muted-foreground">
                      {mappedData.length} orders ready to import
                    </p>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Ready
                  </Badge>
                </div>

                {/* Preview Table */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          {getPreviewColumns().map(col => (
                            <TableHead key={col} className="min-w-[120px]">
                              {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappedData.slice(0, 5).map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            {getPreviewColumns().map(col => (
                              <TableCell key={col} className="truncate max-w-[150px]">
                                {row[col] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {mappedData.length > 5 && (
                    <div className="p-2 text-center text-xs text-muted-foreground bg-muted/50">
                      ...and {mappedData.length - 5} more rows
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Processing/Complete */}
            {step === 'processing' && (
              <div className="space-y-6 py-4">
                {isImporting ? (
                  <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                    <div>
                      <p className="font-medium text-foreground">Importing orders...</p>
                      <p className="text-sm text-muted-foreground">
                        {Math.round((importProgress / 100) * mappedData.length)} of {mappedData.length}
                      </p>
                    </div>
                    <Progress value={importProgress} className="w-full" />
                  </div>
                ) : importResult && (
                  <div className="text-center space-y-4">
                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                      importResult.failed === 0 ? 'bg-green-500/10' : 'bg-yellow-500/10'
                    }`}>
                      <CheckCircle className={`w-8 h-8 ${
                        importResult.failed === 0 ? 'text-green-500' : 'text-yellow-500'
                      }`} />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-foreground">
                        {importResult.success} orders imported
                      </p>
                      {importResult.failed > 0 && (
                        <p className="text-sm text-destructive mt-1">
                          {importResult.failed} failed
                        </p>
                      )}
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="text-left p-3 bg-destructive/10 rounded-lg max-h-32 overflow-y-auto">
                        <p className="text-xs font-medium text-destructive mb-1">Errors:</p>
                        {importResult.errors.slice(0, 5).map((err, i) => (
                          <p key={i} className="text-xs text-destructive/80">{err}</p>
                        ))}
                        {importResult.errors.length > 5 && (
                          <p className="text-xs text-destructive/60 mt-1">
                            ...and {importResult.errors.length - 5} more
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DrawerFooter className="border-t border-border pt-4">
          {step === 'select-template' && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => setStep('upload-file')}
                disabled={!canProceedFromTemplate}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 'upload-file' && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setStep('select-template')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => setStep('review')}
                disabled={!canProceedFromUpload}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 'review' && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setStep('upload-file')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleImport}
              >
                Import {mappedData.length} Orders
              </Button>
            </div>
          )}

          {step === 'processing' && !isImporting && (
            <Button className="w-full" onClick={handleDone}>
              Done
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
