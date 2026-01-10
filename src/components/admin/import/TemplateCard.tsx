import { format } from 'date-fns';
import { Pencil, Trash2, Star, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImportTemplate } from '@/types/import';

interface TemplateCardProps {
  template: ImportTemplate;
  onEdit: (template: ImportTemplate) => void;
  onDelete: (template: ImportTemplate) => void;
  onSetDefault: (template: ImportTemplate) => void;
}

export function TemplateCard({ template, onEdit, onDelete, onSetDefault }: TemplateCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground">{template.template_name}</h3>
              {template.is_default && (
                <Badge variant="default" className="gap-1">
                  <Star className="w-3 h-3" />
                  Default
                </Badge>
              )}
            </div>
            
            {template.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {template.description}
              </p>
            )}
            
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {template.column_mappings.length} columns mapped
              </Badge>
              <span className="text-xs text-muted-foreground">
                Created {format(new Date(template.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {!template.is_default && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onSetDefault(template)}
                title="Set as default"
              >
                <Star className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(template)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(template)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
