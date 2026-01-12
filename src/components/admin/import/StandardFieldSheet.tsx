import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { StandardField } from '@/hooks/useStandardFields';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface StandardFieldSheetProps {
  isOpen: boolean;
  onClose: () => void;
  field?: StandardField | null;
  onSave: (data: {
    field_key: string;
    field_label: string;
    field_type?: string;
    is_required?: boolean;
  }) => Promise<{ success: boolean }>;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
];

export function StandardFieldSheet({ isOpen, onClose, field, onSave }: StandardFieldSheetProps) {
  const isMobile = useIsMobile();
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [isRequired, setIsRequired] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!field;

  useEffect(() => {
    if (field) {
      setFieldLabel(field.field_label);
      setFieldKey(field.field_key);
      setFieldType(field.field_type);
      setIsRequired(field.is_required);
    } else {
      setFieldLabel('');
      setFieldKey('');
      setFieldType('text');
      setIsRequired(false);
    }
  }, [field, isOpen]);

  // Auto-generate key from label
  useEffect(() => {
    if (!isEditing && fieldLabel) {
      setFieldKey(fieldLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    }
  }, [fieldLabel, isEditing]);

  const handleSave = async () => {
    if (!fieldLabel.trim() || !fieldKey.trim()) return;
    
    setIsSaving(true);
    const result = await onSave({
      field_key: fieldKey.trim(),
      field_label: fieldLabel.trim(),
      field_type: fieldType,
      is_required: isRequired,
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
            {isEditing ? 'Edit Standard Field' : 'New Standard Field'}
          </h1>
          {fieldLabel && (
            <p className="text-sm text-muted-foreground truncate">{fieldLabel}</p>
          )}
        </div>
        <Button 
          onClick={handleSave}
          disabled={!fieldLabel.trim() || !fieldKey.trim() || isSaving}
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
          <Card className="border-border">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">1</span>
                </div>
                <h3 className="font-medium text-foreground">Field Configuration</h3>
              </div>
              
              <Separator />
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fieldLabel">Field Label *</Label>
                  <Input
                    id="fieldLabel"
                    value={fieldLabel}
                    onChange={(e) => setFieldLabel(e.target.value)}
                    placeholder="e.g., Client Name, Phone Number"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fieldKey">Field Key *</Label>
                  <Input
                    id="fieldKey"
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value)}
                    placeholder="Auto-generated from label"
                    className="font-mono text-sm"
                    disabled={isEditing}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for CSV column mapping
                  </p>
                </div>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fieldType">Field Type</Label>
                  <Select value={fieldType} onValueChange={setFieldType}>
                    <SelectTrigger id="fieldType">
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
                
                <div className="space-y-2">
                  <Label>Required Field</Label>
                  <div className="flex items-center gap-3 pt-2">
                    <Switch
                      checked={isRequired}
                      onCheckedChange={setIsRequired}
                    />
                    <span className="text-sm text-muted-foreground">
                      {isRequired ? 'This field is required' : 'This field is optional'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );

  return createPortal(content, document.body);
}
