import { format, addDays, isAfter } from 'date-fns';
import { User, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PAYOUT_INTERVAL_DAYS } from '@/hooks/useDriverEarnings';

interface DriverPayrollCardProps {
  driver: {
    id: string;
    full_name: string | null;
    driver_id: string | null;
    avatar_url: string | null;
  };
  firstOrderDate: string | null;
  onView: () => void;
}

export function DriverPayrollCard({ driver, firstOrderDate, onView }: DriverPayrollCardProps) {
  const getInitials = (name: string | null) => {
    if (!name) return 'D';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getNextPayoutDate = () => {
    if (!firstOrderDate) return null;
    const start = new Date(firstOrderDate);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const periodsElapsed = Math.floor(daysSinceStart / PAYOUT_INTERVAL_DAYS);
    return addDays(start, (periodsElapsed + 1) * PAYOUT_INTERVAL_DAYS);
  };

  const nextPayoutDate = getNextPayoutDate();
  const isPayoutDue = nextPayoutDate ? isAfter(new Date(), nextPayoutDate) : false;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <Avatar className="h-12 w-12 border-2 border-border">
            <AvatarImage src={driver.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials(driver.full_name)}
            </AvatarFallback>
          </Avatar>

          {/* Driver Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">
                {driver.full_name || 'Unknown Driver'}
              </h3>
              {isPayoutDue && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Due
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {driver.driver_id || 'No ID'}
            </p>
            {nextPayoutDate && (
              <div className="flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Next Payout: {format(nextPayoutDate, 'MMM dd, yyyy')}
                </span>
              </div>
            )}
          </div>

          {/* View Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onView}
            className="shrink-0"
          >
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
