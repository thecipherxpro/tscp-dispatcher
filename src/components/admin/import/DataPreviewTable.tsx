import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ColumnMapping } from '@/types/import';

interface DataPreviewTableProps {
  data: Record<string, any>[];
  mappings: ColumnMapping[];
  maxRows?: number;
}

export function DataPreviewTable({ data, mappings, maxRows = 5 }: DataPreviewTableProps) {
  const previewData = data.slice(0, maxRows);
  const activeMappings = mappings.filter(m => m.field_key !== 'skip');

  if (activeMappings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No columns mapped yet
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            {activeMappings.map((mapping) => (
              <TableHead key={mapping.csv_column} className="whitespace-nowrap">
                {mapping.field_label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {previewData.map((row, idx) => (
            <TableRow key={idx}>
              {activeMappings.map((mapping) => (
                <TableCell key={mapping.csv_column} className="whitespace-nowrap max-w-[200px] truncate">
                  {row[mapping.csv_column] ?? '—'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
