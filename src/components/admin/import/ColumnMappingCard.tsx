import { Check, ArrowRight, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ParsedFileColumn, DrugType, StandardField, STANDARD_ORDER_FIELDS } from '@/types/import';
import { cn } from '@/lib/utils';

interface ColumnMappingCardProps {
  column: ParsedFileColumn;
  mappedTo: string;
  onMappingChange: (csvColumn: string, fieldKey: string) => void;
  drugTypes: DrugType[];
  usedFields: Map<string, string>;
  isMobile?: boolean;
  standardFields?: StandardField[];
}
export function ColumnMappingCard({
  column,
  mappedTo,
  onMappingChange,
  drugTypes,
  usedFields,
  isMobile = false,
  standardFields
}: ColumnMappingCardProps) {
  const isMapped = mappedTo && mappedTo !== 'skip';
  
  // Use provided standard fields or fall back to hardcoded ones
  const activeStandardFields = standardFields && standardFields.length > 0 
    ? standardFields 
    : STANDARD_ORDER_FIELDS;

  // Get the display label for the mapped field
  const getMappedLabel = (): string => {
    if (!isMapped) return 'Not mapped';
    const standardField = activeStandardFields.find(f => f.key === mappedTo);
    if (standardField) return standardField.label;
    for (const drugType of drugTypes) {
      const prefix = `${drugType.drug_type_key}_`;
      if (mappedTo.startsWith(prefix)) {
        const fieldName = mappedTo.slice(prefix.length);
        const field = drugType.field_schema.find(f => f.key === fieldName);
        if (field) return `${drugType.display_name}: ${field.label}`;
      }
    }
    return mappedTo;
  };

  // Get drug type info for badge
  const getDrugTypeBadge = (): {
    label: string;
    key: string;
  } | null => {
    if (!isMapped) return null;
    for (const drugType of drugTypes) {
      const prefix = `${drugType.drug_type_key}_`;
      if (mappedTo.startsWith(prefix)) {
        return {
          label: drugType.display_name,
          key: drugType.drug_type_key
        };
      }
    }
    return null;
  };
  const drugTypeBadge = getDrugTypeBadge();

  // Get text color based on drug type
  const getColumnTextColor = (): string => {
    if (!isMapped) return 'text-foreground';
    for (const drugType of drugTypes) {
      const prefix = `${drugType.drug_type_key}_`;
      if (mappedTo.startsWith(prefix)) {
        if (drugType.drug_type_key === 'injection') {
          return 'text-blue-600 dark:text-blue-400';
        }
        if (drugType.drug_type_key === 'nasal') {
          return 'text-purple-600 dark:text-purple-400';
        }
      }
    }
    return 'text-foreground';
  };
  const columnTextColor = getColumnTextColor();
  return <Card className={cn("transition-all duration-200 overflow-hidden w-full max-w-full", isMapped ? "border-orange-400/60 bg-orange-50 dark:bg-orange-950/20 shadow-sm ring-1 ring-orange-400/30" : "border-border bg-card hover:border-muted-foreground/30")}>
      <CardContent className={cn("overflow-hidden w-full max-w-full", isMobile ? "p-2" : "p-3")}>
        {/* Column Header with Status */}
        <div className={cn("flex items-start justify-between gap-1.5 overflow-hidden w-full max-w-full", isMobile ? "mb-1.5" : "mb-3")}>
          <div className="flex-1 min-w-0 overflow-hidden w-full max-w-full">
            <div className="flex items-center gap-1.5 mb-0.5 overflow-hidden w-full max-w-full">
              {isMapped ? <div className={cn("rounded-full bg-orange-500 flex items-center justify-center shrink-0", isMobile ? "w-3.5 h-3.5" : "w-5 h-5")}>
                  <Check className={cn("text-white", isMobile ? "w-2 h-2" : "w-3 h-3")} />
                </div> : <div className={cn("rounded-full bg-muted flex items-center justify-center shrink-0", isMobile ? "w-3.5 h-3.5" : "w-5 h-5")}>
                  <X className={cn("text-muted-foreground", isMobile ? "w-2 h-2" : "w-3 h-3")} />
                </div>}
              <p className={cn("font-mono font-medium truncate flex-1 min-w-0", isMobile ? "text-[11px]" : "text-sm", columnTextColor)}>
                {column.name}
              </p>
            </div>
            {column.sampleData && <p className={cn("text-muted-foreground truncate w-full max-w-full", isMobile ? "text-[10px] ml-5" : "text-xs ml-7")}>
                Sample: <span className="font-medium truncate">{column.sampleData}</span>
              </p>}
          </div>
        </div>
        
        {/* Mapping Indicator */}
        {isMapped && <div className={cn("flex items-center gap-1 overflow-hidden w-full max-w-full", isMobile ? "mb-1.5 ml-5" : "mb-3 ml-7")}>
            <ArrowRight className={cn("shrink-0", isMobile ? "w-2.5 h-2.5" : "w-3 h-3", drugTypeBadge?.key === 'injection' && "text-blue-600 dark:text-blue-400", drugTypeBadge?.key === 'nasal' && "text-purple-600 dark:text-purple-400", !drugTypeBadge && "text-orange-500")} />
            <div className="flex-1 ">
              <span className={cn("font-medium truncate flex-1 min-w-0", isMobile ? "text-[11px]" : "text-sm", drugTypeBadge?.key === 'injection' && "text-blue-600 dark:text-blue-400", drugTypeBadge?.key === 'nasal' && "text-purple-600 dark:text-purple-400", !drugTypeBadge && "text-orange-600 dark:text-orange-400")}>
                {getMappedLabel().split(': ').pop()}
              </span>
              {drugTypeBadge && <Badge variant="secondary" className={cn("px-1 py-0 shrink-0", isMobile ? "text-[8px] h-3" : "text-[10px] h-4 px-1.5", drugTypeBadge.key === 'injection' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", drugTypeBadge.key === 'nasal' && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400")}>
                  {drugTypeBadge.label}
                </Badge>}
            </div>
          </div>}
        
        {/* Select Dropdown */}
        <Select value={mappedTo || 'skip'} onValueChange={value => onMappingChange(column.name, value)}>
          <SelectTrigger className={cn("w-full max-w-full", isMobile ? "h-7 text-[11px]" : "", isMapped ? "border-primary/30 bg-background" : "border-input bg-background")}>
            <SelectValue placeholder="Select field..." />
          </SelectTrigger>
          <SelectContent className="max-h-[280px] sm:max-h-[320px] bg-popover z-[100] overflow-y-auto">
            {/* Skip Option */}
            <SelectItem value="skip" className="text-muted-foreground">
              — Do not import —
            </SelectItem>
            
            {/* Standard Fields Group */}
            <SelectGroup>
              <SelectLabel className="text-[11px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider bg-muted sticky top-0 z-10 border-b border-border">
                📋 Standard Fields
              </SelectLabel>
              {activeStandardFields.map(field => {
                const usedBy = usedFields.get(field.key);
                const isUsed = usedBy && usedBy !== column.name;
                return (
                  <SelectItem 
                    key={field.key} 
                    value={field.key} 
                    disabled={isUsed} 
                    className={cn(
                      isUsed && "opacity-50"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate">{field.label}</span>
                      {isUsed && <span className="text-[10px] text-muted-foreground shrink-0">(used)</span>}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectGroup>
            
            {/* Drug Type Groups */}
            {drugTypes.map(drugType => (
              <SelectGroup key={drugType.id}>
                <SelectLabel className={cn(
                  "text-[11px] sm:text-xs font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-border",
                  drugType.drug_type_key === 'injection' && "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
                  drugType.drug_type_key === 'nasal' && "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
                  !['injection', 'nasal'].includes(drugType.drug_type_key) && "bg-muted text-muted-foreground"
                )}>
                  {drugType.drug_type_key === 'injection' && '💉 '}
                  {drugType.drug_type_key === 'nasal' && '👃 '}
                  {drugType.display_name}
                </SelectLabel>
                {drugType.field_schema.map(field => {
                  const fieldKey = `${drugType.drug_type_key}_${field.key}`;
                  const usedBy = usedFields.get(fieldKey);
                  const isUsed = usedBy && usedBy !== column.name;
                  return (
                    <SelectItem 
                      key={fieldKey} 
                      value={fieldKey} 
                      disabled={isUsed} 
                      className={cn(
                        isUsed && "opacity-50",
                        drugType.drug_type_key === 'injection' && "border-l-2 border-blue-400 ml-1",
                        drugType.drug_type_key === 'nasal' && "border-l-2 border-purple-400 ml-1"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn(
                          "truncate",
                          drugType.drug_type_key === 'injection' && "text-blue-700 dark:text-blue-300",
                          drugType.drug_type_key === 'nasal' && "text-purple-700 dark:text-purple-300"
                        )}>
                          {field.label}
                        </span>
                        {isUsed && <span className="text-[10px] text-muted-foreground shrink-0">(used)</span>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>;
}