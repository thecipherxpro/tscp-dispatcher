import { useEffect, useState } from 'react';
import pharmanetLogo from '@/assets/pharmanet-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 800);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-700 ease-in-out ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div 
        className={`flex flex-col items-center transition-all duration-1000 ease-out ${
          fadeOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        style={{
          animation: 'fadeInScale 0.8s ease-out forwards'
        }}
      >
        <img 
          src={pharmanetLogo} 
          alt="PharmaNet Delivery Service" 
          className="w-64 h-64 object-contain"
        />
      </div>
      <style>{`
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
