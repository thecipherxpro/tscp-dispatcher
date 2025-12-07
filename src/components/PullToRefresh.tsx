import { useState, useRef, useCallback, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const haptic = useHapticFeedback();

  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);
    
    if (distance > 0 && containerRef.current?.scrollTop === 0) {
      setPullDistance(Math.min(distance * 0.5, threshold * 1.5));
      
      if (distance > threshold && pullDistance <= threshold) {
        haptic.light();
      }
    }
  }, [isPulling, pullDistance, haptic]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      haptic.medium();
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setIsPulling(false);
    setPullDistance(0);
  }, [pullDistance, isRefreshing, onRefresh, haptic]);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto h-full ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div 
        className="flex items-center justify-center transition-all duration-200"
        style={{ 
          height: isRefreshing ? 48 : pullDistance,
          opacity: pullDistance > 20 || isRefreshing ? 1 : 0,
        }}
      >
        <RefreshCw 
          className={`w-5 h-5 text-primary transition-transform ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: !isRefreshing ? `rotate(${pullDistance * 2}deg)` : undefined,
          }}
        />
      </div>
      
      {children}
    </div>
  );
}
