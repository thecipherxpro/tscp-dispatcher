import { Pencil, Trash2, Pill } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DrugType } from '@/types/import';

interface DrugTypeCardProps {
  drugType: DrugType;
  onEdit: (drugType: DrugType) => void;
  onDelete: (drugType: DrugType) => void;
  onToggleActive: (drugType: DrugType, isActive: boolean) => void;
}

export function DrugTypeCard({ drugType, onEdit, onDelete, onToggleActive }: DrugTypeCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Pill className="w-5 h-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground">{drugType.display_name}</h3>
              <Badge variant="secondary" className="text-xs font-mono">
                {drugType.drug_type_key}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {drugType.field_schema.length} fields
              </Badge>
            </div>
            
            {drugType.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {drugType.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Switch
              checked={drugType.is_active}
              onCheckedChange={(checked) => onToggleActive(drugType, checked)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(drugType)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(drugType)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
