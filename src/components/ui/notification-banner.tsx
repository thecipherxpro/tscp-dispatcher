import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationBannerProps {
  type: 'success' | 'error';
  title: string;
  message?: string;
  isOpen: boolean;
  onClose: () => void;
  autoCloseMs?: number;
}

export function NotificationBanner({
  type,
  title,
  message,
  isOpen,
  onClose,
  autoCloseMs = 3000
}: NotificationBannerProps) {
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Auto close timer
  useEffect(() => {
    if (isOpen && autoCloseMs > 0) {
      const timer = setTimeout(onClose, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseMs, onClose]);

  // Reset translate when opening
  useEffect(() => {
    if (isOpen) {
      setTranslateY(0);
    }
  }, [isOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const deltaY = e.touches[0].clientY - touchStartY;
    // Only allow dragging up (negative) to dismiss
    if (deltaY < 0) {
      setTranslateY(deltaY);
    }
  }, [touchStartY]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    // If dragged more than 50px up, close
    if (translateY < -50) {
      onClose();
    } else {
      setTranslateY(0);
    }
    setTouchStartY(null);
  }, [translateY, onClose]);

  if (!isOpen) return null;

  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] pointer-events-none">
      <div
        className={cn(
          "pointer-events-auto mx-auto max-w-md p-4 pt-safe",
          !isDragging && "transition-transform duration-200 ease-out"
        )}
        style={{ transform: `translateY(${translateY}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg",
            type === 'success' && "bg-emerald-600 text-white",
            type === 'error' && "bg-destructive text-destructive-foreground"
          )}
        >
          <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{title}</p>
            {message && (
              <p className="text-sm opacity-90 mt-0.5 truncate">{message}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Swipe indicator */}
        <div className="flex justify-center mt-2">
          <div className="w-8 h-1 rounded-full bg-white/30" />
        </div>
      </div>
    </div>
  );
}

// Hook for easy notification management
interface NotificationState {
  isOpen: boolean;
  type: 'success' | 'error';
  title: string;
  message?: string;
}

export function useNotificationBanner() {
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  const showSuccess = useCallback((title: string, message?: string) => {
    setNotification({ isOpen: true, type: 'success', title, message });
  }, []);

  const showError = useCallback((title: string, message?: string) => {
    setNotification({ isOpen: true, type: 'error', title, message });
  }, []);

  const close = useCallback(() => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    notification,
    showSuccess,
    showError,
    close
  };
}
