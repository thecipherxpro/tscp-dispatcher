import { format } from 'date-fns';
import { Calendar, DollarSign, Check, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PayoutPeriodCardProps {
  start: Date;
  end: Date;
  amount: number;
  isPaid: boolean;
  onView: () => void;
}

export function PayoutPeriodCard({ start, end, amount, isPaid, onView }: PayoutPeriodCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">
                {format(start, 'MMM dd')} - {format(end, 'MMM dd')}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <DollarSign className="w-3 h-3 text-green-600" />
                <span className="text-sm font-semibold text-green-600">
                  ${amount.toFixed(2)}
                </span>
                {isPaid ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/20">
                    <Check className="w-2.5 h-2.5 mr-0.5" />
                    Paid
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/20">
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onView}>
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
