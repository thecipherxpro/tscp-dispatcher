import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DrugType, DrugFieldSchema, DEFAULT_DRUG_FIELDS } from '@/types/import';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface DrugTypeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  drugType?: DrugType | null;
  onSave: (data: {
    display_name: string;
    drug_type_key?: string;
    description?: string;
    field_schema?: DrugFieldSchema[];
  }) => Promise<{ success: boolean }>;
}

const FIELD_TYPES: { value: DrugFieldSchema['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
];

export function DrugTypeSheet({ isOpen, onClose, drugType, onSave }: DrugTypeSheetProps) {
  const isMobile = useIsMobile();
  const [displayName, setDisplayName] = useState('');
  const [drugTypeKey, setDrugTypeKey] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<DrugFieldSchema[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showFieldEditor, setShowFieldEditor] = useState(false);

  const isEditing = !!drugType;

  useEffect(() => {
    if (drugType) {
      setDisplayName(drugType.display_name);
      setDrugTypeKey(drugType.drug_type_key);
      setDescription(drugType.description || '');
      setFields([...drugType.field_schema]);
      setShowFieldEditor(false);
    } else {
      setDisplayName('');
      setDrugTypeKey('');
      setDescription('');
      setFields([...DEFAULT_DRUG_FIELDS]);
      setShowFieldEditor(false);
    }
  }, [drugType, isOpen]);

  useEffect(() => {
    if (!isEditing && displayName) {
      setDrugTypeKey(displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    }
  }, [displayName, isEditing]);

  const handleAddField = () => {
    const newField: DrugFieldSchema = {
      key: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
    };
    setFields([...fields, newField]);
  };

  const handleRemoveField = (index: number) => {
    const newFields = [...fields];
    newFields.splice(index, 1);
    setFields(newFields);
  };

  const handleUpdateField = (index: number, updates: Partial<DrugFieldSchema>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    
    // Auto-generate key from label if label changed
    if (updates.label && !isEditing) {
      newFields[index].key = updates.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }
    
    setFields(newFields);
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    
    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!displayName.trim()) return;
    
    setIsSaving(true);
    const result = await onSave({
      display_name: displayName.trim(),
      drug_type_key: isEditing ? undefined : drugTypeKey.trim() || undefined,
      description: description.trim() || undefined,
      field_schema: fields,
    });
    setIsSaving(false);
    
    if (result.success) {
      onClose();
    }
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
            {isEditing ? 'Edit Drug Type' : 'New Drug Type'}
          </h1>
          {displayName && (
            <p className="text-sm text-muted-foreground truncate">{displayName}</p>
          )}
        </div>
        <Button 
          onClick={handleSave}
          disabled={!displayName.trim() || fields.length === 0 || isSaving}
          className="shrink-0"
        >
          {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
        </Button>
      </header>
      
      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className={cn(
          "mx-auto w-full pb-8",
          isMobile ? "px-4 py-4" : "max-w-2xl px-6 py-6"
        )}>
          <div className="space-y-6">
            {/* Basic Info Section */}
            <Card className="border-border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">1</span>
                  </div>
                  <h3 className="font-medium text-foreground">Basic Information</h3>
                </div>
                
                <Separator />
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name *</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., Injection, Oral, Nasal"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="drugTypeKey">Key</Label>
                    <Input
                      id="drugTypeKey"
                      value={drugTypeKey}
                      onChange={(e) => setDrugTypeKey(e.target.value)}
                      placeholder="Auto-generated from name"
                      className="font-mono text-sm"
                      disabled={isEditing}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for CSV column prefixes (e.g., {drugTypeKey || 'injection'}_rx_number)
                    </p>
                  </div>
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
              </CardContent>
            </Card>
            
            {/* Fields Section */}
            <Card className="border-border">
              <CardContent className="p-4">
                <Collapsible open={showFieldEditor} onOpenChange={setShowFieldEditor}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">2</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">Fields</h3>
                          <p className="text-sm text-muted-foreground">
                            {fields.length} fields configured
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{fields.length}</Badge>
                        {showFieldEditor ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-4 space-y-3">
                    <Separator />
                    
                    {/* Field List */}
                    <div className="space-y-3 mt-4">
                      {fields.map((field, index) => (
                        <Card key={field.key + index} className="bg-muted/30 border-border">
                          <CardContent className="p-3">
                            <div className="space-y-3">
                              {/* Field Header */}
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => handleMoveField(index, 'up')}
                                    disabled={index === 0}
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => handleMoveField(index, 'down')}
                                    disabled={index === fields.length - 1}
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </Button>
                                </div>
                                
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                  <Input
                                    value={field.label}
                                    onChange={(e) => handleUpdateField(index, { label: e.target.value })}
                                    placeholder="Field label"
                                    className="h-8 text-sm"
                                  />
                                  <Select
                                    value={field.type}
                                    onValueChange={(value: DrugFieldSchema['type']) => 
                                      handleUpdateField(index, { type: value })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FIELD_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>
                                          {t.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleRemoveField(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              
                              {/* Field Details */}
                              <div className="flex items-center justify-between pl-8">
                                <div className="flex items-center gap-2">
                                  <code className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                                    {drugTypeKey || 'prefix'}_{field.key}
                                  </code>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label htmlFor={`required-${index}`} className="text-xs text-muted-foreground">
                                    Required
                                  </Label>
                                  <Switch
                                    id={`required-${index}`}
                                    checked={field.required}
                                    onCheckedChange={(checked) => 
                                      handleUpdateField(index, { required: checked })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {/* Add Field Button */}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleAddField}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Field
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
                
                {/* Field Preview (when collapsed) */}
                {!showFieldEditor && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {fields.map((field) => (
                      <Badge 
                        key={field.key} 
                        variant={field.required ? 'default' : 'secondary'}
                      >
                        {field.label}
                        {field.required && ' *'}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );

  return createPortal(content, document.body);
}