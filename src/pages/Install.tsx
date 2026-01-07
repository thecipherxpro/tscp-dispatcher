import { Download, Share, Plus, Smartphone, Wifi, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import endoverdoseLogo from '@/assets/endoverdose-logo.png';

export default function Install() {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();

  const handleInstall = async () => {
    await promptInstall();
  };

  const benefits = [
    { icon: Wifi, title: 'Works Offline', description: 'Access your deliveries even without internet' },
    { icon: Zap, title: 'Faster Loading', description: 'Instant startup, no browser delays' },
    { icon: Smartphone, title: 'Native Feel', description: 'Full-screen app experience on your device' },
  ];

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Already Installed!</h1>
          <p className="text-muted-foreground">
            EndOverdose is installed on your device. Open it from your home screen for the best experience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <img 
          src={endoverdoseLogo} 
          alt="EndOverdose" 
          className="w-24 h-24 object-contain mb-6"
        />
        <h1 className="text-3xl font-bold text-foreground mb-2">Install EndOverdose</h1>
        <p className="text-muted-foreground max-w-sm mb-8">
          Add EndOverdose to your home screen for quick access and offline functionality.
        </p>

        {/* Benefits */}
        <div className="grid gap-4 w-full max-w-sm mb-8">
          {benefits.map((benefit) => (
            <Card key={benefit.title} className="bg-card/50">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-foreground text-sm">{benefit.title}</h3>
                  <p className="text-xs text-muted-foreground">{benefit.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Install Instructions */}
        {isIOS ? (
          <Card className="w-full max-w-sm bg-card/50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-4">How to Install on iOS</h3>
              <ol className="space-y-4 text-left">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="text-sm text-foreground">
                      Tap the <Share className="inline w-4 h-4 mx-1" /> Share button in Safari
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="text-sm text-foreground">
                      Scroll and tap "Add to Home Screen" <Plus className="inline w-4 h-4 mx-1" />
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="text-sm text-foreground">
                      Tap "Add" to confirm
                    </p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        ) : isInstallable ? (
          <Button size="lg" onClick={handleInstall} className="gap-2 w-full max-w-sm">
            <Download className="w-5 h-5" />
            Install App
          </Button>
        ) : (
          <Card className="w-full max-w-sm bg-card/50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-4">How to Install</h3>
              <p className="text-sm text-muted-foreground">
                Open this page in Chrome, Edge, or Safari and look for the install option in your browser's menu.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
