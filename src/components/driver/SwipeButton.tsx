import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SwipeButtonProps {
  onSwipeComplete: () => void;
  label: string;
  icon: React.ReactNode;
  variant?: 'primary' | 'destructive' | 'secondary';
  disabled?: boolean;
  isLoading?: boolean;
}

export function SwipeButton({ 
  onSwipeComplete, 
  label, 
  icon, 
  variant = 'primary',
  disabled = false,
  isLoading = false
}: SwipeButtonProps) {
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const maxSwipeRef = useRef(0);

  useEffect(() => {
    if (containerRef.current) {
      maxSwipeRef.current = containerRef.current.offsetWidth - 64;
    }
  }, []);

  const handleStart = (clientX: number) => {
    if (disabled || isLoading) return;
    setIsDragging(true);
    startXRef.current = clientX;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || disabled) return;
    const diff = clientX - startXRef.current;
    const progress = Math.max(0, Math.min(diff / maxSwipeRef.current, 1));
    setSwipeProgress(progress);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (swipeProgress >= 0.85) {
      onSwipeComplete();
    }
    setSwipeProgress(0);
  };

  const variantStyles = {
    primary: 'bg-primary',
    destructive: 'bg-destructive',
    secondary: 'bg-secondary',
  };

  const thumbStyles = {
    primary: 'bg-primary-foreground text-primary',
    destructive: 'bg-destructive-foreground text-destructive',
    secondary: 'bg-secondary-foreground text-secondary',
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-14 rounded-full overflow-hidden transition-opacity',
        variantStyles[variant],
        disabled && 'opacity-50'
      )}
    >
      {/* Track label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn(
          'text-sm font-medium transition-opacity',
          variant === 'primary' ? 'text-primary-foreground' : 
          variant === 'destructive' ? 'text-destructive-foreground' : 'text-secondary-foreground',
          swipeProgress > 0.3 && 'opacity-0'
        )}>
          {label}
        </span>
      </div>

      {/* Swipe thumb */}
      <div
        className={cn(
          'absolute top-1 left-1 w-12 h-12 rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing transition-transform',
          thumbStyles[variant],
          isDragging && 'scale-105'
        )}
        style={{ 
          transform: `translateX(${swipeProgress * maxSwipeRef.current}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          icon
        )}
      </div>

      {/* Completion indicator */}
      {swipeProgress >= 0.85 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/20 animate-pulse">
          <span className="text-sm font-bold text-primary-foreground">Release!</span>
        </div>
      )}
    </div>
  );
}
