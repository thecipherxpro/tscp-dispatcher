import { Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ParsedFileColumn, DrugType, STANDARD_ORDER_FIELDS } from '@/types/import';

interface ColumnMappingCardProps {
  column: ParsedFileColumn;
  mappedTo: string;
  onMappingChange: (csvColumn: string, fieldKey: string) => void;
  drugTypes: DrugType[];
  usedFields: Map<string, string>;
}

export function ColumnMappingCard({
  column,
  mappedTo,
  onMappingChange,
  drugTypes,
  usedFields,
}: ColumnMappingCardProps) {
  const isMapped = mappedTo && mappedTo !== 'skip';

  return (
    <Card className={`bg-card border-border ${isMapped ? 'border-primary/50' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          {isMapped && (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm font-medium text-foreground truncate">
              {column.name}
            </p>
            {column.sampleData && (
              <p className="text-xs text-muted-foreground truncate">
                e.g., {column.sampleData}
              </p>
            )}
          </div>
        </div>
        
        <Select
          value={mappedTo || 'skip'}
          onValueChange={(value) => onMappingChange(column.name, value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select field..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="skip">— Do not import —</SelectItem>
            
            <SelectGroup>
              <SelectLabel>Standard Fields</SelectLabel>
              {STANDARD_ORDER_FIELDS.map((field) => {
                const usedBy = usedFields.get(field.key);
                const isUsed = usedBy && usedBy !== column.name;
                return (
                  <SelectItem
                    key={field.key}
                    value={field.key}
                    disabled={isUsed}
                  >
                    {field.label}
                    {isUsed && ` (used by ${usedBy})`}
                  </SelectItem>
                );
              })}
            </SelectGroup>
            
            {drugTypes.map((drugType) => (
              <SelectGroup key={drugType.id}>
                <SelectLabel>{drugType.display_name}</SelectLabel>
                {drugType.field_schema.map((field) => {
                  const fieldKey = `${drugType.drug_type_key}_${field.key}`;
                  const usedBy = usedFields.get(fieldKey);
                  const isUsed = usedBy && usedBy !== column.name;
                  return (
                    <SelectItem
                      key={fieldKey}
                      value={fieldKey}
                      disabled={isUsed}
                    >
                      {field.label}
                      {isUsed && ` (used by ${usedBy})`}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
