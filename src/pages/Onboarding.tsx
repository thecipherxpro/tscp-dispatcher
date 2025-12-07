import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Package, MapPin, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingSlide } from '@/components/onboarding/OnboardingSlide';

const slides = [
  {
    icon: <Truck className="w-full h-full" />,
    title: "Welcome to TSCP Dispatch",
    description: "Your complete pharmaceutical delivery management solution designed for efficiency and compliance.",
  },
  {
    icon: <Package className="w-full h-full" />,
    title: "Manage Orders Seamlessly",
    description: "Import, assign, and track delivery orders with real-time updates and timeline tracking.",
  },
  {
    icon: <MapPin className="w-full h-full" />,
    title: "Real-Time Tracking",
    description: "Stay informed with live delivery status updates and secure public tracking links.",
  },
  {
    icon: <Shield className="w-full h-full" />,
    title: "PHIPA Compliant",
    description: "Built with privacy in mind. All personal health information is protected and secure.",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      localStorage.setItem('tscp-onboarding-complete', 'true');
      navigate('/auth');
    }
  };

  const handleSkip = () => {
    localStorage.setItem('tscp-onboarding-complete', 'true');
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col safe-area-inset">
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {slides.map((slide, index) => (
          <OnboardingSlide
            key={index}
            icon={slide.icon}
            title={slide.title}
            description={slide.description}
            isActive={index === currentSlide}
          />
        ))}
      </div>

      <div className="px-6 pb-8 space-y-6">
        <div className="flex justify-center space-x-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? 'w-8 bg-primary'
                  : 'bg-muted hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={handleSkip}
          >
            Skip
          </Button>
          <Button
            className="flex-1"
            onClick={handleNext}
          >
            {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
