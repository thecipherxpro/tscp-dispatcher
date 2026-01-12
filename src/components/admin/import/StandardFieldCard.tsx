import { Edit, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { StandardField } from '@/hooks/useStandardFields';

interface StandardFieldCardProps {
  field: StandardField;
  onEdit: (field: StandardField) => void;
  onDelete: (field: StandardField) => void;
  onToggleActive: (field: StandardField, isActive: boolean) => void;
}

export function StandardFieldCard({ field, onEdit, onDelete, onToggleActive }: StandardFieldCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-foreground truncate">{field.field_label}</h3>
              {field.is_required && (
                <Badge variant="secondary" className="text-xs">Required</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{field.field_key}</code>
              <span className="text-muted-foreground/50">•</span>
              <span className="capitalize">{field.field_type}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={field.is_active}
              onCheckedChange={(checked) => onToggleActive(field, checked)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(field)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(field)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
