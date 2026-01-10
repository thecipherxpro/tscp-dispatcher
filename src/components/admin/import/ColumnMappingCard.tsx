import { Check, ArrowRight, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { ParsedFileColumn, DrugType, STANDARD_ORDER_FIELDS } from '@/types/import';
import { cn } from '@/lib/utils';

interface ColumnMappingCardProps {
  column: ParsedFileColumn;
  mappedTo: string;
  onMappingChange: (csvColumn: string, fieldKey: string) => void;
  drugTypes: DrugType[];
  usedFields: Map<string, string>;
  isMobile?: boolean;
}

export function ColumnMappingCard({
  column,
  mappedTo,
  onMappingChange,
  drugTypes,
  usedFields,
  isMobile = false,
}: ColumnMappingCardProps) {
  const isMapped = mappedTo && mappedTo !== 'skip';

  // Get the display label for the mapped field
  const getMappedLabel = (): string => {
    if (!isMapped) return 'Not mapped';
    
    const standardField = STANDARD_ORDER_FIELDS.find(f => f.key === mappedTo);
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
  const getDrugTypeBadge = (): { label: string; key: string } | null => {
    if (!isMapped) return null;
    
    for (const drugType of drugTypes) {
      const prefix = `${drugType.drug_type_key}_`;
      if (mappedTo.startsWith(prefix)) {
        return { label: drugType.display_name, key: drugType.drug_type_key };
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

  return (
    <Card className={cn(
      "transition-all duration-200 overflow-hidden",
      isMapped 
        ? "border-orange-400/60 bg-orange-50 dark:bg-orange-950/20 shadow-sm ring-1 ring-orange-400/30" 
        : "border-border bg-card hover:border-muted-foreground/30"
    )}>
      <CardContent className={cn("overflow-hidden", isMobile ? "p-2.5" : "p-3")}>
        {/* Column Header with Status */}
        <div className={cn("flex items-start justify-between gap-2 overflow-hidden", isMobile ? "mb-2" : "mb-3")}>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 overflow-hidden">
              {isMapped ? (
                <div className={cn(
                  "rounded-full bg-orange-500 flex items-center justify-center shrink-0",
                  isMobile ? "w-4 h-4" : "w-5 h-5"
                )}>
                  <Check className={cn("text-white", isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                </div>
              ) : (
                <div className={cn(
                  "rounded-full bg-muted flex items-center justify-center shrink-0",
                  isMobile ? "w-4 h-4" : "w-5 h-5"
                )}>
                  <X className={cn("text-muted-foreground", isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                </div>
              )}
              <p className={cn(
                "font-mono font-medium truncate max-w-full",
                isMobile ? "text-xs" : "text-sm",
                columnTextColor
              )}>
                {column.name}
              </p>
            </div>
            {column.sampleData && (
              <p className={cn(
                "text-muted-foreground truncate",
                isMobile ? "text-[10px] ml-5" : "text-xs ml-7"
              )}>
                Sample: <span className="font-medium">{column.sampleData}</span>
              </p>
            )}
          </div>
        </div>
        
        {/* Mapping Indicator */}
        {isMapped && (
          <div className={cn(
            "flex items-center gap-1.5 sm:gap-2 overflow-hidden",
            isMobile ? "mb-2 ml-5" : "mb-3 ml-7"
          )}>
            <ArrowRight className={cn(
              "shrink-0",
              isMobile ? "w-2.5 h-2.5" : "w-3 h-3",
              drugTypeBadge?.key === 'injection' && "text-blue-600 dark:text-blue-400",
              drugTypeBadge?.key === 'nasal' && "text-purple-600 dark:text-purple-400",
              !drugTypeBadge && "text-orange-500"
            )} />
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap min-w-0 overflow-hidden">
              <span className={cn(
                "font-medium truncate",
                isMobile ? "text-xs" : "text-sm",
                drugTypeBadge?.key === 'injection' && "text-blue-600 dark:text-blue-400",
                drugTypeBadge?.key === 'nasal' && "text-purple-600 dark:text-purple-400",
                !drugTypeBadge && "text-orange-600 dark:text-orange-400"
              )}>
                {getMappedLabel().split(': ').pop()}
              </span>
              {drugTypeBadge && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "px-1 py-0 shrink-0",
                    isMobile ? "text-[9px] h-3.5" : "text-[10px] h-4 px-1.5",
                    drugTypeBadge.key === 'injection' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                    drugTypeBadge.key === 'nasal' && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  )}
                >
                  {drugTypeBadge.label}
                </Badge>
              )}
            </div>
          </div>
        )}
        
        {/* Select Dropdown */}
        <Select
          value={mappedTo || 'skip'}
          onValueChange={(value) => onMappingChange(column.name, value)}
        >
          <SelectTrigger className={cn(
            "w-full",
            isMobile ? "h-8 text-xs" : "",
            isMapped 
              ? "border-primary/30 bg-background" 
              : "border-input bg-background"
          )}>
            <SelectValue placeholder="Select field..." />
          </SelectTrigger>
          <SelectContent className="max-h-[250px] sm:max-h-[300px] bg-popover z-[100]">
            <SelectItem value="skip" className="text-muted-foreground">
              — Do not import —
            </SelectItem>
            
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                Standard Fields
              </SelectLabel>
              {STANDARD_ORDER_FIELDS.map((field) => {
                const usedBy = usedFields.get(field.key);
                const isUsed = usedBy && usedBy !== column.name;
                return (
                  <SelectItem
                    key={field.key}
                    value={field.key}
                    disabled={isUsed}
                    className={cn(isUsed && "opacity-50")}
                  >
                    <span className="flex items-center gap-2">
                      {field.label}
                      {isUsed && (
                        <span className="text-[10px] text-muted-foreground">
                          (used)
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectGroup>
            
            {drugTypes.map((drugType) => (
              <SelectGroup key={drugType.id}>
                <SelectLabel className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  drugType.drug_type_key === 'injection' && "text-blue-600 dark:text-blue-400",
                  drugType.drug_type_key === 'nasal' && "text-purple-600 dark:text-purple-400"
                )}>
                  {drugType.display_name}
                </SelectLabel>
                {drugType.field_schema.map((field) => {
                  const fieldKey = `${drugType.drug_type_key}_${field.key}`;
                  const usedBy = usedFields.get(fieldKey);
                  const isUsed = usedBy && usedBy !== column.name;
                  return (
                    <SelectItem
                      key={fieldKey}
                      value={fieldKey}
                      disabled={isUsed}
                      className={cn(isUsed && "opacity-50")}
                    >
                      <span className="flex items-center gap-2">
                        {field.label}
                        {isUsed && (
                          <span className="text-[10px] text-muted-foreground">
                            (used)
                          </span>
                        )}
                      </span>
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
