import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DrugType, DrugFieldSchema, DEFAULT_DRUG_FIELDS } from '@/types/import';

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

export function DrugTypeSheet({ isOpen, onClose, drugType, onSave }: DrugTypeSheetProps) {
  const [displayName, setDisplayName] = useState('');
  const [drugTypeKey, setDrugTypeKey] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!drugType;

  useEffect(() => {
    if (drugType) {
      setDisplayName(drugType.display_name);
      setDrugTypeKey(drugType.drug_type_key);
      setDescription(drugType.description || '');
    } else {
      setDisplayName('');
      setDrugTypeKey('');
      setDescription('');
    }
  }, [drugType, isOpen]);

  useEffect(() => {
    if (!isEditing && displayName) {
      setDrugTypeKey(displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    }
  }, [displayName, isEditing]);

  const handleSave = async () => {
    if (!displayName.trim()) return;
    
    setIsSaving(true);
    const result = await onSave({
      display_name: displayName.trim(),
      drug_type_key: drugTypeKey.trim() || undefined,
      description: description.trim() || undefined,
      field_schema: isEditing ? drugType?.field_schema : DEFAULT_DRUG_FIELDS,
    });
    setIsSaving(false);
    
    if (result.success) {
      onClose();
    }
  };

  const fieldsToShow = isEditing ? drugType?.field_schema : DEFAULT_DRUG_FIELDS;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle>{isEditing ? 'Edit Drug Type' : 'Add Drug Type'}</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-4 overflow-y-auto pb-20">
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
              className="font-mono"
              disabled={isEditing}
            />
            <p className="text-xs text-muted-foreground">
              Used for CSV column prefixes (e.g., injection_rx_number)
            </p>
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
          
          <div className="space-y-2">
            <Label>Fields</Label>
            <div className="flex flex-wrap gap-2">
              {fieldsToShow?.map((field) => (
                <Badge key={field.key} variant={field.required ? 'default' : 'secondary'}>
                  {field.label}
                  {field.required && ' *'}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {isEditing ? 'Edit fields in advanced settings' : 'Default fields will be applied'}
            </p>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleSave}
              disabled={!displayName.trim() || isSaving}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
