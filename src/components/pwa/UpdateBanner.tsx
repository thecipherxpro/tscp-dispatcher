import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformInfo {
  isAndroid: boolean;
  isChrome: boolean;
  isIOS: boolean;
  supportsNativeUpdate: boolean;
}

function getPlatformInfo(): PlatformInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(userAgent);
  const isChrome = /chrome/.test(userAgent) && !/edg/.test(userAgent);
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  
  // Android + Chrome supports native PWA updates
  const supportsNativeUpdate = isAndroid && isChrome;
  
  return { isAndroid, isChrome, isIOS, supportsNativeUpdate };
}

async function clearCacheAndReload() {
  try {
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    // Unregister service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    
    // Force reload without cache
    window.location.reload();
  } catch (error) {
    console.error('Error clearing cache:', error);
    // Fallback to simple reload
    window.location.reload();
  }
}

export function UpdateBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const platformInfo = getPlatformInfo();
  
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('SW Registered:', registration);
      
      // Check for updates every 5 minutes
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  // Handle offline ready notification (briefly show then auto-dismiss)
  useEffect(() => {
    if (offlineReady) {
      // Just log it, don't show toast for offline ready
      console.log('App ready for offline use');
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      if (platformInfo.supportsNativeUpdate) {
        // Android + Chrome: trigger native PWA update
        await updateServiceWorker(true);
      } else {
        // iOS / other devices: clear cache and reload
        await clearCacheAndReload();
      }
    } catch (error) {
      console.error('Update failed:', error);
      // Fallback to cache clear
      await clearCacheAndReload();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Auto-show again after 1 hour if still needs refresh
    setTimeout(() => setDismissed(false), 60 * 60 * 1000);
  };

  // Don't show if no update available or dismissed
  if (!needRefresh || dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100]",
        "bg-primary text-primary-foreground",
        "px-3 py-2.5 sm:px-4 sm:py-3",
        "shadow-lg",
        "animate-in slide-in-from-top duration-300"
      )}
    >
      <div className="flex items-center justify-between gap-2 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            {platformInfo.supportsNativeUpdate ? (
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium truncate">
              A new version is available
            </p>
            <p className="text-[10px] sm:text-xs opacity-80 truncate">
              {platformInfo.supportsNativeUpdate 
                ? 'Tap to install the latest update' 
                : 'Tap to refresh and get the latest version'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleUpdate}
            disabled={isUpdating}
            className={cn(
              "h-7 sm:h-8 px-2.5 sm:px-3 text-xs sm:text-sm font-medium gap-1.5",
              "bg-background text-foreground hover:bg-background/90"
            )}
          >
            {isUpdating ? (
              <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
            ) : platformInfo.supportsNativeUpdate ? (
              <Download className="w-3 h-3 sm:w-4 sm:h-4" />
            ) : (
              <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            <span className="hidden xs:inline">
              {platformInfo.supportsNativeUpdate ? 'Install Update' : 'Refresh'}
            </span>
            <span className="xs:hidden">
              {platformInfo.supportsNativeUpdate ? 'Update' : 'Refresh'}
            </span>
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-7 sm:h-8 w-7 sm:w-8 p-0 hover:bg-primary-foreground/10"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
