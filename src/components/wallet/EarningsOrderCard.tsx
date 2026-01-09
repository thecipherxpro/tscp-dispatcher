import { ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DriverEarning } from '@/hooks/useDriverEarnings';

interface EarningsOrderCardProps {
  earning: DriverEarning;
  onClick: () => void;
}

export function EarningsOrderCard({ earning, onClick }: EarningsOrderCardProps) {
  const formattedDate = format(new Date(earning.completed_at), 'MMM d, yyyy');
  const formattedTime = format(new Date(earning.completed_at), 'h:mm a');
  const formattedAmount = `$${earning.total_earnings.toFixed(2)}`;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full bg-card border border-border rounded-xl p-4",
        "flex items-center justify-between text-left",
        "transition-all active:scale-[0.98] hover:bg-muted/50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-semibold text-foreground text-sm">
            #{earning.shipment_id || 'N/A'}
          </p>
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
            Completed
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formattedDate} at {formattedTime}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-bold text-primary text-lg">
          {formattedAmount}
        </p>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </button>
  );
}
