import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ColumnMappingCard } from './ColumnMappingCard';
import { DataPreviewTable } from './DataPreviewTable';
import { 
  ImportTemplate, 
  ColumnMapping, 
  ParsedFileColumn, 
  FileParseResult,
  DrugType,
  STANDARD_ORDER_FIELDS 
} from '@/types/import';
import { useIsMobile } from '@/hooks/use-mobile';

interface TemplateBuilderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  template?: ImportTemplate | null;
  drugTypes: DrugType[];
  onSave: (data: {
    template_name: string;
    description?: string;
    column_mappings: ColumnMapping[];
    drug_type_mappings?: any[];
    is_default?: boolean;
  }) => Promise<{ success: boolean }>;
}

// Normalize column name for matching
function normalizeColumnName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Auto-match column to field
function autoMatchColumn(columnName: string, drugTypes: DrugType[]): string | null {
  const normalized = normalizeColumnName(columnName);
  
  // Check standard fields
  for (const field of STANDARD_ORDER_FIELDS) {
    const fieldNorm = normalizeColumnName(field.label);
    if (normalized === fieldNorm || normalized === field.key) {
      return field.key;
    }
  }
  
  // Check drug type fields with prefixes (e.g., INJ_RX -> injection_rx_number)
  for (const drugType of drugTypes) {
    const prefix = drugType.drug_type_key.slice(0, 3).toUpperCase();
    
    for (const field of drugType.field_schema) {
      const fieldKey = `${drugType.drug_type_key}_${field.key}`;
      const fieldNorm = normalizeColumnName(field.label);
      
      // Match by prefix (e.g., INJ_RX_NUMBER)
      if (normalized.startsWith(prefix.toLowerCase() + '_')) {
        const rest = normalized.slice(prefix.length + 1);
        if (rest === field.key || rest === fieldNorm) {
          return fieldKey;
        }
      }
      
      // Match by full drug type prefix
      if (normalized.startsWith(drugType.drug_type_key + '_')) {
        const rest = normalized.slice(drugType.drug_type_key.length + 1);
        if (rest === field.key || rest === fieldNorm) {
          return fieldKey;
        }
      }
    }
  }
  
  return null;
}

export function TemplateBuilderSheet({ 
  isOpen, 
  onClose, 
  template, 
  drugTypes,
  onSave 
}: TemplateBuilderSheetProps) {
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // File parsing state
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<FileParseResult | null>(null);
  const [columnMappings, setColumnMappings] = useState<Map<string, string>>(new Map());
  
  const isEditing = !!template;

  useEffect(() => {
    if (template) {
      setTemplateName(template.template_name);
      setDescription(template.description || '');
      setIsDefault(template.is_default);
      
      // Restore mappings from template
      const mappings = new Map<string, string>();
      template.column_mappings.forEach(m => {
        mappings.set(m.csv_column, m.field_key);
      });
      setColumnMappings(mappings);
    } else {
      setTemplateName('');
      setDescription('');
      setIsDefault(false);
      setColumnMappings(new Map());
    }
    setFileName(null);
    setParseResult(null);
  }, [template, isOpen]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      return;
    }
    
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        
        if (jsonData.length === 0) return;
        
        // Extract columns with sample data
        const headers = Object.keys(jsonData[0]);
        const columns: ParsedFileColumn[] = headers.map(name => {
          // Find first non-empty value
          let sampleData = '';
          for (const row of jsonData.slice(0, 5)) {
            if (row[name] !== '' && row[name] !== null && row[name] !== undefined) {
              sampleData = String(row[name]);
              break;
            }
          }
          return { name, sampleData };
        });
        
        setParseResult({
          columns,
          rowCount: jsonData.length,
          rawData: jsonData,
        });
        
        // Auto-match columns if not editing
        if (!isEditing || columnMappings.size === 0) {
          const newMappings = new Map<string, string>();
          columns.forEach(col => {
            const match = autoMatchColumn(col.name, drugTypes);
            if (match) {
              newMappings.set(col.name, match);
            }
          });
          setColumnMappings(newMappings);
        }
      } catch (error) {
        console.error('Error parsing file:', error);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [drugTypes, isEditing, columnMappings.size]);

  const clearFile = () => {
    setFileName(null);
    setParseResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMappingChange = (csvColumn: string, fieldKey: string) => {
    const newMappings = new Map(columnMappings);
    if (fieldKey === 'skip') {
      newMappings.delete(csvColumn);
    } else {
      newMappings.set(csvColumn, fieldKey);
    }
    setColumnMappings(newMappings);
  };

  // Build used fields map for disabling already-used options
  const usedFields = new Map<string, string>();
  columnMappings.forEach((fieldKey, csvColumn) => {
    if (fieldKey !== 'skip') {
      usedFields.set(fieldKey, csvColumn);
    }
  });

  // Build column mappings array for saving
  const buildColumnMappingsArray = (): ColumnMapping[] => {
    const mappings: ColumnMapping[] = [];
    
    columnMappings.forEach((fieldKey, csvColumn) => {
      if (fieldKey === 'skip') return;
      
      // Find label for the field
      let fieldLabel = fieldKey;
      let drugTypeKey: string | undefined;
      
      // Check standard fields
      const standardField = STANDARD_ORDER_FIELDS.find(f => f.key === fieldKey);
      if (standardField) {
        fieldLabel = standardField.label;
      } else {
        // Check drug type fields
        for (const dt of drugTypes) {
          const prefix = `${dt.drug_type_key}_`;
          if (fieldKey.startsWith(prefix)) {
            const fieldName = fieldKey.slice(prefix.length);
            const field = dt.field_schema.find(f => f.key === fieldName);
            if (field) {
              fieldLabel = field.label;
              drugTypeKey = dt.drug_type_key;
            }
            break;
          }
        }
      }
      
      mappings.push({
        csv_column: csvColumn,
        field_key: fieldKey,
        field_label: fieldLabel,
        drug_type_key: drugTypeKey,
      });
    });
    
    return mappings;
  };

  const handleSave = async () => {
    if (!templateName.trim()) return;
    
    setIsSaving(true);
    const result = await onSave({
      template_name: templateName.trim(),
      description: description.trim() || undefined,
      column_mappings: buildColumnMappingsArray(),
      is_default: isDefault,
    });
    setIsSaving(false);
    
    if (result.success) {
      onClose();
    }
  };

  const mappedCount = columnMappings.size;
  const skippedCount = (parseResult?.columns.length || 0) - mappedCount;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 pb-2 border-b border-border">
            <SheetTitle>{isEditing ? 'Edit Template' : 'New Import Template'}</SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6 pb-24">
              {/* Section 1: Template Information */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Template Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="templateName">Template Name *</Label>
                  <Input
                    id="templateName"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., PharmaDocs Standard Import"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={2}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="isDefault">Set as Default</Label>
                    <p className="text-xs text-muted-foreground">
                      Auto-selected when importing orders
                    </p>
                  </div>
                  <Switch
                    id="isDefault"
                    checked={isDefault}
                    onCheckedChange={setIsDefault}
                  />
                </div>
              </div>
              
              <Separator />
              
              {/* Section 2: Sample File Upload */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Sample File</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a sample CSV or Excel file to configure column mappings
                </p>
                
                {!fileName ? (
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload CSV or Excel file
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{fileName}</p>
                        {parseResult && (
                          <p className="text-xs text-muted-foreground">
                            {parseResult.columns.length} columns, {parseResult.rowCount} rows
                          </p>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={clearFile}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Section 3: Column Mapping */}
              {parseResult && parseResult.columns.length > 0 && (
                <>
                  <Separator />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-foreground">Column Mapping</h3>
                      <div className="flex gap-2">
                        {mappedCount > 0 && (
                          <Badge variant="default" className="gap-1">
                            <Check className="w-3 h-3" />
                            {mappedCount} mapped
                          </Badge>
                        )}
                        {skippedCount > 0 && (
                          <Badge variant="secondary">
                            {skippedCount} skipped
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid gap-3 sm:grid-cols-2">
                      {parseResult.columns.map((column) => (
                        <ColumnMappingCard
                          key={column.name}
                          column={column}
                          mappedTo={columnMappings.get(column.name) || 'skip'}
                          onMappingChange={handleMappingChange}
                          drugTypes={drugTypes}
                          usedFields={usedFields}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              {/* Section 4: Data Preview */}
              {parseResult && mappedCount > 0 && (
                <>
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="font-medium text-foreground">Data Preview</h3>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <DataPreviewTable
                        data={parseResult.rawData}
                        mappings={buildColumnMappingsArray()}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          
          {/* Fixed Footer */}
          <div className="p-4 bg-background border-t border-border">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSave}
                disabled={!templateName.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : isEditing ? 'Update Template' : 'Save Template'}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
