import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '@/hooks/use-toast';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OfflineReadyToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('SW Registered:', registration);
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast({
        title: 'Ready for offline use',
        description: 'App has been cached and works offline.',
        duration: 4000,
      });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast({
        title: 'Update available',
        description: 'A new version is available. Click update to refresh.',
        action: (
          <Button 
            size="sm" 
            onClick={() => updateServiceWorker(true)}
            className="gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            Update
          </Button>
        ),
        duration: 0, // Don't auto-dismiss
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
