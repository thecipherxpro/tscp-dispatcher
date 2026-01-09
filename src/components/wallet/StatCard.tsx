import { LucideIcon, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'primary';
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  variant = 'default',
  className 
}: StatCardProps) {
  const dotColors = {
    default: 'bg-muted-foreground',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    primary: 'bg-primary',
  };

  return (
    <div className={cn(
      "bg-card border border-border rounded-2xl p-4 relative",
      className
    )}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <button className="p-1 hover:bg-muted rounded-full transition-colors">
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <p className="text-2xl font-bold text-primary mb-1">{value}</p>
      {subtitle && (
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full", dotColors[variant])} />
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      )}
    </div>
  );
}
