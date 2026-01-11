import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unavailable';

function useLocationPermission() {
  const [status, setStatus] = useState<PermissionStatus>('unavailable');

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }

    // Check permission status using Permissions API
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          setStatus(result.state as PermissionStatus);
          
          // Listen for permission changes
          result.onchange = () => {
            setStatus(result.state as PermissionStatus);
          };
        })
        .catch(() => {
          // Permissions API not fully supported, assume prompt
          setStatus('prompt');
        });
    } else {
      // No Permissions API, assume prompt is needed
      setStatus('prompt');
    }
  }, []);

  return status;
}

function isInstalledPWA(): boolean {
  // Check if running in standalone mode (installed PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  return isStandalone || isIOSStandalone;
}

export function LocationPermissionBanner() {
  const permissionStatus = useLocationPermission();
  const [dismissed, setDismissed] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsInstalled(isInstalledPWA());

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => setIsInstalled(isInstalledPWA());
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Check if banner was previously dismissed
  useEffect(() => {
    const dismissedAt = localStorage.getItem('location-permission-dismissed');
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      // Show again after 24 hours
      if (hoursSinceDismissed < 24) {
        setDismissed(true);
      }
    }
  }, []);

  const requestPermission = useCallback(async () => {
    setIsRequesting(true);
    
    try {
      // Request location permission by trying to get current position
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
    } catch (error) {
      console.log('Location permission denied or error:', error);
    } finally {
      setIsRequesting(false);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('location-permission-dismissed', Date.now().toString());
    setDismissed(true);
  };

  // Only show for installed PWA when permission is not granted and not dismissed
  const shouldShow = 
    isInstalled && 
    permissionStatus === 'prompt' && 
    !dismissed;

  if (!shouldShow) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[99]",
        "bg-blue-600 text-white",
        "px-3 py-2.5 sm:px-4 sm:py-3",
        "shadow-lg",
        "animate-in slide-in-from-top duration-300"
      )}
    >
      <div className="flex items-center justify-between gap-2 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium truncate">
              Enable Location Access
            </p>
            <p className="text-[10px] sm:text-xs opacity-80 truncate">
              Required for delivery tracking and navigation
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={requestPermission}
            disabled={isRequesting}
            className={cn(
              "h-7 sm:h-8 px-2.5 sm:px-3 text-xs sm:text-sm font-medium gap-1.5",
              "bg-white text-blue-600 hover:bg-white/90"
            )}
          >
            {isRequesting ? (
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 animate-pulse" />
            ) : (
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            <span className="hidden xs:inline">Allow Location</span>
            <span className="xs:hidden">Allow</span>
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-7 sm:h-8 w-7 sm:w-8 p-0 hover:bg-white/10"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
