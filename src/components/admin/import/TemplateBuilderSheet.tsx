import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, FileSpreadsheet, Check, AlertCircle, ArrowLeft, ChevronDown, ChevronUp, Columns } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { cn } from '@/lib/utils';

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
  
  // Check drug type fields with prefixes
  for (const drugType of drugTypes) {
    const prefix = drugType.drug_type_key.slice(0, 3).toUpperCase();
    
    for (const field of drugType.field_schema) {
      const fieldKey = `${drugType.drug_type_key}_${field.key}`;
      const fieldNorm = normalizeColumnName(field.label);
      
      if (normalized.startsWith(prefix.toLowerCase() + '_')) {
        const rest = normalized.slice(prefix.length + 1);
        if (rest === field.key || rest === fieldNorm) {
          return fieldKey;
        }
      }
      
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
  
  // Collapsible sections state
  const [sectionsOpen, setSectionsOpen] = useState({
    info: true,
    file: true,
    mapping: true,
    preview: false
  });
  
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
    setSectionsOpen({ info: true, file: true, mapping: true, preview: false });
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
        
        const headers = Object.keys(jsonData[0]);
        const columns: ParsedFileColumn[] = headers.map(name => {
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

  const usedFields = new Map<string, string>();
  columnMappings.forEach((fieldKey, csvColumn) => {
    if (fieldKey !== 'skip') {
      usedFields.set(fieldKey, csvColumn);
    }
  });

  const buildColumnMappingsArray = (): ColumnMapping[] => {
    const mappings: ColumnMapping[] = [];
    
    columnMappings.forEach((fieldKey, csvColumn) => {
      if (fieldKey === 'skip') return;
      
      let fieldLabel = fieldKey;
      let drugTypeKey: string | undefined;
      
      const standardField = STANDARD_ORDER_FIELDS.find(f => f.key === fieldKey);
      if (standardField) {
        fieldLabel = standardField.label;
      } else {
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
  const totalColumns = parseResult?.columns.length || 0;
  const skippedCount = totalColumns - mappedCount;

  // Separate mapped and unmapped columns for better organization
  const mappedColumns = parseResult?.columns.filter(col => columnMappings.has(col.name)) || [];
  const unmappedColumns = parseResult?.columns.filter(col => !columnMappings.has(col.name)) || [];

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Sticky Header */}
          <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">
                {isEditing ? 'Edit Template' : 'New Import Template'}
              </h1>
              {templateName && (
                <p className="text-sm text-muted-foreground truncate">{templateName}</p>
              )}
            </div>
            <Button 
              onClick={handleSave}
              disabled={!templateName.trim() || isSaving}
              className="shrink-0"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </header>
          
          {/* Scrollable Content */}
          <ScrollArea className="flex-1">
            <div className={cn(
              "mx-auto w-full pb-8",
              isMobile ? "px-4 py-4" : "max-w-4xl px-6 py-6"
            )}>
              <div className="space-y-4">
                {/* Section 1: Template Information */}
                <Collapsible open={sectionsOpen.info} onOpenChange={() => toggleSection('info')}>
                  <Card className="border-border">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">1</span>
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">Template Information</h3>
                            <p className="text-xs text-muted-foreground">Name and description</p>
                          </div>
                        </div>
                        {sectionsOpen.info ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-4 px-4 space-y-4">
                        <Separator className="mb-4" />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="templateName">Template Name *</Label>
                            <Input
                              id="templateName"
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value)}
                              placeholder="e.g., Naloxone Kit Template"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                              id="description"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Optional description"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <Label htmlFor="isDefault" className="cursor-pointer">Set as Default</Label>
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
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
                
                {/* Section 2: Sample File Upload */}
                <Collapsible open={sectionsOpen.file} onOpenChange={() => toggleSection('file')}>
                  <Card className="border-border">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">2</span>
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">Sample File</h3>
                            <p className="text-xs text-muted-foreground">
                              {fileName ? fileName : 'Upload CSV or Excel'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {fileName && (
                            <Badge variant="secondary" className="gap-1">
                              <FileSpreadsheet className="w-3 h-3" />
                              Loaded
                            </Badge>
                          )}
                          {sectionsOpen.file ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-4 px-4">
                        <Separator className="mb-4" />
                        
                        {!fileName ? (
                          <div
                            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                            <p className="font-medium text-foreground mb-1">
                              Click to upload sample file
                            </p>
                            <p className="text-sm text-muted-foreground">
                              CSV or Excel (.xlsx, .xls)
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
                          <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileSpreadsheet className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{fileName}</p>
                                {parseResult && (
                                  <p className="text-sm text-muted-foreground">
                                    {parseResult.columns.length} columns • {parseResult.rowCount} rows
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={clearFile}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
                
                {/* Section 3: Column Mapping */}
                {parseResult && parseResult.columns.length > 0 && (
                  <Collapsible open={sectionsOpen.mapping} onOpenChange={() => toggleSection('mapping')}>
                    <Card className="border-border">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">3</span>
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground">Column Mapping</h3>
                              <p className="text-xs text-muted-foreground">
                                Map CSV columns to order fields
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {mappedCount > 0 && (
                              <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/20 border-0">
                                <Check className="w-3 h-3" />
                                {mappedCount} mapped
                              </Badge>
                            )}
                            {skippedCount > 0 && (
                              <Badge variant="secondary" className="gap-1">
                                {skippedCount} skipped
                              </Badge>
                            )}
                            {sectionsOpen.mapping ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 pb-4 px-4">
                          <Separator className="mb-4" />
                          
                          {/* Mapped Columns Section */}
                          {mappedColumns.length > 0 && (
                            <div className="mb-6">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                <h4 className="text-sm font-medium text-foreground">
                                  Mapped Columns ({mappedColumns.length})
                                </h4>
                              </div>
                              <div className={cn(
                                "grid gap-3",
                                isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"
                              )}>
                                {mappedColumns.map((column) => (
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
                          )}
                          
                          {/* Unmapped Columns Section */}
                          {unmappedColumns.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                                <h4 className="text-sm font-medium text-muted-foreground">
                                  Unmapped Columns ({unmappedColumns.length})
                                </h4>
                              </div>
                              <div className={cn(
                                "grid gap-3",
                                isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"
                              )}>
                                {unmappedColumns.map((column) => (
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
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
                
                {/* Section 4: Data Preview */}
                {parseResult && mappedCount > 0 && (
                  <Collapsible open={sectionsOpen.preview} onOpenChange={() => toggleSection('preview')}>
                    <Card className="border-border">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">4</span>
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground">Data Preview</h3>
                              <p className="text-xs text-muted-foreground">
                                Preview how data will be imported
                              </p>
                            </div>
                          </div>
                          {sectionsOpen.preview ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 pb-4 px-4">
                          <Separator className="mb-4" />
                          <div className="border border-border rounded-lg overflow-hidden">
                            <DataPreviewTable
                              data={parseResult.rawData}
                              mappings={buildColumnMappingsArray()}
                            />
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
  );

  return createPortal(content, document.body);
}
