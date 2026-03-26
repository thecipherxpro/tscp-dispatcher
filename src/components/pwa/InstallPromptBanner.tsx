import { useState, useEffect } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import medxpressLogo from '@/assets/logo-dark.png';

export function InstallPromptBanner() {
  const { isInstallable, isInstalled, isIOS, promptInstall, dismissPrompt, shouldShowPrompt } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Delay showing the banner to not interrupt initial experience
    const timer = setTimeout(() => {
      setIsVisible(shouldShowPrompt());
    }, 3000);

    return () => clearTimeout(timer);
  }, [shouldShowPrompt]);

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    dismissPrompt();
    setIsVisible(false);
  };

  if (!isVisible || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t border-border shadow-lg animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-4 max-w-lg mx-auto">
        <img 
          src={medxpressLogo} 
          alt="MedXpress" 
          className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
        />
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm">Install MedXpress</h3>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Tap <Share className="inline w-3 h-3 mx-0.5" /> then "Add to Home Screen" <Plus className="inline w-3 h-3 mx-0.5" />
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Install for offline access & quick launch
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isIOS && isInstallable && (
            <Button 
              size="sm" 
              onClick={handleInstall}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              Install
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
