import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
      setTimeout(onComplete, 500);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary transition-opacity duration-500 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex flex-col items-center space-y-6 animate-fade-in">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-primary-foreground/20 flex items-center justify-center animate-pulse-slow">
            <Truck className="w-12 h-12 text-primary-foreground animate-bounce-subtle" />
          </div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-foreground/30 animate-ping-slow" />
        </div>
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary-foreground tracking-tight">
            TSCP Dispatch
          </h1>
          <p className="text-primary-foreground/70 text-sm">
            Pharmaceutical Delivery Management
          </p>
        </div>

        <div className="flex space-x-1 mt-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary-foreground/60 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
