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
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden w-full max-w-full">
          {/* Sticky Header */}
          <header className="sticky top-0 z-10 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shrink-0 w-full max-w-full">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="shrink-0 h-8 w-8 sm:h-9 sm:w-9"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="flex-1 min-w-0 overflow-hidden">
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">
                {isEditing ? 'Edit Template' : 'New Import Template'}
              </h1>
              {templateName && (
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{templateName}</p>
              )}
            </div>
            <Button 
              onClick={handleSave}
              disabled={!templateName.trim() || isSaving}
              size={isMobile ? "sm" : "default"}
              className="shrink-0"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </header>
          
          {/* Scrollable Content */}
          <div className="flex-1 w-full max-w-full overflow-y-auto overscroll-contain">
            <div
              className={cn(
                "mx-auto pb-8 w-full max-w-full box-border",
                isMobile ? "px-2 py-3" : "max-w-4xl px-6 py-6",
              )}
            >
              <div className="space-y-4 w-full max-w-full overflow-hidden">
                {/* Section 1: Template Information */}
                <Collapsible open={sectionsOpen.info} onOpenChange={() => toggleSection('info')}>
                  <Card className="border-border">
                    <CollapsibleTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors",
                          isMobile ? "p-3 gap-2" : "p-4 gap-3",
                        )}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div
                            className={cn(
                              "rounded-full bg-primary/10 flex items-center justify-center shrink-0",
                              isMobile ? "w-6 h-6" : "w-8 h-8",
                            )}
                          >
                            <span className={cn("font-medium text-primary", isMobile ? "text-xs" : "text-sm")}>1</span>
                          </div>
                          <div className="min-w-0">
                            <h3
                              className={cn(
                                "font-medium text-foreground truncate",
                                isMobile ? "text-sm" : "text-base",
                              )}
                            >
                              Template Information
                            </h3>
                            <p
                              className={cn(
                                "text-muted-foreground truncate",
                                isMobile ? "text-[10px]" : "text-xs",
                              )}
                            >
                              Name and description
                            </p>
                          </div>
                        </div>
                        {sectionsOpen.info ? (
                          <ChevronUp className={cn("text-muted-foreground shrink-0", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                        ) : (
                          <ChevronDown className={cn("text-muted-foreground shrink-0", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent
                        className={cn(
                          "pt-0 space-y-4",
                          isMobile ? "pb-3 px-3" : "pb-4 px-4",
                        )}
                      >
                        <Separator className="mb-4" />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="templateName" className={isMobile ? "text-sm" : ""}>
                              Template Name *
                            </Label>
                            <Input
                              id="templateName"
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value)}
                              placeholder="e.g., Naloxone Kit Template"
                              className={isMobile ? "h-9 text-sm" : ""}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="description" className={isMobile ? "text-sm" : ""}>
                              Description
                            </Label>
                            <Input
                              id="description"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Optional description"
                              className={isMobile ? "h-9 text-sm" : ""}
                            />
                          </div>
                        </div>

                        <div
                          className={cn(
                            "flex items-center justify-between bg-muted/50 rounded-lg",
                            isMobile ? "p-2.5" : "p-3",
                          )}
                        >
                          <div className="min-w-0">
                            <Label htmlFor="isDefault" className={cn("cursor-pointer", isMobile && "text-sm")}>
                              Set as Default
                            </Label>
                            <p className={cn("text-muted-foreground", isMobile ? "text-[10px]" : "text-xs")}>
                              Auto-selected when importing orders
                            </p>
                          </div>
                          <Switch id="isDefault" checked={isDefault} onCheckedChange={setIsDefault} />
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Section 2: Sample File Upload */}
                <Collapsible open={sectionsOpen.file} onOpenChange={() => toggleSection('file')}>
                  <Card className="border-border">
                    <CollapsibleTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors",
                          isMobile ? "p-3 gap-2" : "p-4 gap-3",
                        )}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div
                            className={cn(
                              "rounded-full bg-primary/10 flex items-center justify-center shrink-0",
                              isMobile ? "w-6 h-6" : "w-8 h-8",
                            )}
                          >
                            <span className={cn("font-medium text-primary", isMobile ? "text-xs" : "text-sm")}>2</span>
                          </div>
                          <div className="min-w-0">
                            <h3
                              className={cn(
                                "font-medium text-foreground truncate",
                                isMobile ? "text-sm" : "text-base",
                              )}
                            >
                              Sample File
                            </h3>
                            <p
                              className={cn(
                                "text-muted-foreground truncate",
                                isMobile ? "text-[10px]" : "text-xs",
                              )}
                            >
                              {fileName ? fileName : 'Upload CSV or Excel'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          {fileName && (
                            <Badge
                              variant="secondary"
                              className={cn("gap-1", isMobile && "text-[10px] px-1.5 py-0")}
                            >
                              <FileSpreadsheet className={isMobile ? "w-2.5 h-2.5" : "w-3 h-3"} />
                              Loaded
                            </Badge>
                          )}
                          {sectionsOpen.file ? (
                            <ChevronUp className={cn("text-muted-foreground", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                          ) : (
                            <ChevronDown className={cn("text-muted-foreground", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className={cn("pt-0", isMobile ? "pb-3 px-3" : "pb-4 px-4")}>
                        <Separator className="mb-4" />

                        {!fileName ? (
                          <div
                            className={cn(
                              "border-2 border-dashed border-border rounded-lg text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors",
                              isMobile ? "p-5" : "p-8",
                            )}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload
                              className={cn(
                                "mx-auto mb-3 text-muted-foreground",
                                isMobile ? "w-8 h-8" : "w-10 h-10",
                              )}
                            />
                            <p className={cn("font-medium text-foreground mb-1", isMobile && "text-sm")}>
                              Click to upload sample file
                            </p>
                            <p className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
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
                          <div
                            className={cn(
                              "flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg",
                              isMobile ? "p-3 gap-2" : "p-4 gap-3",
                            )}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              <div
                                className={cn(
                                  "rounded-lg bg-primary/10 flex items-center justify-center shrink-0",
                                  isMobile ? "w-8 h-8" : "w-10 h-10",
                                )}
                              >
                                <FileSpreadsheet className={cn("text-primary", isMobile ? "w-4 h-4" : "w-5 h-5")} />
                              </div>
                              <div className="min-w-0">
                                <p className={cn("font-medium text-foreground truncate", isMobile && "text-sm")}>
                                  {fileName}
                                </p>
                                {parseResult && (
                                  <p className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                                    {parseResult.columns.length} columns • {parseResult.rowCount} rows
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={clearFile}
                              className={isMobile ? "h-8 w-8" : ""}
                            >
                              <X className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
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
                        <div
                          className={cn(
                            "flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors",
                            isMobile ? "p-3 gap-2" : "p-4 gap-3",
                          )}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div
                              className={cn(
                                "rounded-full bg-primary/10 flex items-center justify-center shrink-0",
                                isMobile ? "w-6 h-6" : "w-8 h-8",
                              )}
                            >
                              <span className={cn("font-medium text-primary", isMobile ? "text-xs" : "text-sm")}>3</span>
                            </div>
                            <div className="min-w-0">
                              <h3
                                className={cn(
                                  "font-medium text-foreground truncate",
                                  isMobile ? "text-sm" : "text-base",
                                )}
                              >
                                Column Mapping
                              </h3>
                              <p
                                className={cn(
                                  "text-muted-foreground truncate",
                                  isMobile ? "text-[10px]" : "text-xs",
                                )}
                              >
                                Map CSV columns to order fields
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            {mappedCount > 0 && (
                              <Badge
                                className={cn(
                                  "gap-1 bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 border-0",
                                  isMobile && "text-[10px] px-1.5 py-0",
                                )}
                              >
                                <Check className={isMobile ? "w-2.5 h-2.5" : "w-3 h-3"} />
                                {mappedCount} mapped
                              </Badge>
                            )}
                            {skippedCount > 0 && (
                              <Badge
                                variant="secondary"
                                className={cn("gap-1", isMobile && "text-[10px] px-1.5 py-0")}
                              >
                                {skippedCount} skipped
                              </Badge>
                            )}
                            {sectionsOpen.mapping ? (
                              <ChevronUp className={cn("text-muted-foreground", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                            ) : (
                              <ChevronDown className={cn("text-muted-foreground", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent
                          className={cn(
                            "pt-0 overflow-hidden w-full max-w-full",
                            isMobile ? "pb-3 px-1.5" : "pb-4 px-4",
                          )}
                        >
                          <Separator className="mb-3 sm:mb-4" />

                          {/* Mapped Columns Section */}
                          {mappedColumns.length > 0 && (
                            <div className="mb-4 sm:mb-6">
                              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                                <h4
                                  className={cn(
                                    "font-medium text-orange-600 dark:text-orange-400",
                                    isMobile ? "text-xs" : "text-sm",
                                  )}
                                >
                                  Mapped Columns ({mappedColumns.length})
                                </h4>
                              </div>
                              <div
                                className={cn(
                                  "grid gap-2 sm:gap-3 w-full max-w-full",
                                  isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3",
                                )}
                              >
                                {mappedColumns.map((column) => (
                                  <ColumnMappingCard
                                    key={column.name}
                                    column={column}
                                    mappedTo={columnMappings.get(column.name) || 'skip'}
                                    onMappingChange={handleMappingChange}
                                    drugTypes={drugTypes}
                                    usedFields={usedFields}
                                    isMobile={isMobile}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unmapped Columns Section */}
                          {unmappedColumns.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                <div className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
                                <h4
                                  className={cn(
                                    "font-medium text-muted-foreground",
                                    isMobile ? "text-xs" : "text-sm",
                                  )}
                                >
                                  Unmapped Columns ({unmappedColumns.length})
                                </h4>
                              </div>
                              <div
                                className={cn(
                                  "grid gap-2 sm:gap-3 w-full max-w-full",
                                  isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3",
                                )}
                              >
                                {unmappedColumns.map((column) => (
                                  <ColumnMappingCard
                                    key={column.name}
                                    column={column}
                                    mappedTo={columnMappings.get(column.name) || 'skip'}
                                    onMappingChange={handleMappingChange}
                                    drugTypes={drugTypes}
                                    usedFields={usedFields}
                                    isMobile={isMobile}
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
                        <div
                          className={cn(
                            "flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors",
                            isMobile ? "p-3 gap-2" : "p-4 gap-3",
                          )}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div
                              className={cn(
                                "rounded-full bg-primary/10 flex items-center justify-center shrink-0",
                                isMobile ? "w-6 h-6" : "w-8 h-8",
                              )}
                            >
                              <span className={cn("font-medium text-primary", isMobile ? "text-xs" : "text-sm")}>4</span>
                            </div>
                            <div className="min-w-0">
                              <h3
                                className={cn(
                                  "font-medium text-foreground truncate",
                                  isMobile ? "text-sm" : "text-base",
                                )}
                              >
                                Data Preview
                              </h3>
                              <p
                                className={cn(
                                  "text-muted-foreground truncate",
                                  isMobile ? "text-[10px]" : "text-xs",
                                )}
                              >
                                Preview how data will be imported
                              </p>
                            </div>
                          </div>
                          {sectionsOpen.preview ? (
                            <ChevronUp className={cn("text-muted-foreground shrink-0", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                          ) : (
                            <ChevronDown className={cn("text-muted-foreground shrink-0", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className={cn("pt-0", isMobile ? "pb-3 px-3" : "pb-4 px-4")}>
                          <Separator className="mb-4" />
                          <div className="border border-border rounded-lg overflow-hidden">
                            <DataPreviewTable data={parseResult.rawData} mappings={buildColumnMappingsArray()} />
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
              </div>
            </div>
          </div>
        </div>
  );

  return createPortal(content, document.body);
}
