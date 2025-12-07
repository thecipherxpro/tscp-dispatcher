import { ReactNode } from 'react';

interface OnboardingSlideProps {
  icon: ReactNode;
  title: string;
  description: string;
  isActive: boolean;
}

export function OnboardingSlide({ icon, title, description, isActive }: OnboardingSlideProps) {
  return (
    <div 
      className={`flex flex-col items-center justify-center text-center px-8 transition-all duration-500 ${
        isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 absolute'
      }`}
    >
      <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center mb-8">
        <div className="w-16 h-16 text-primary">
          {icon}
        </div>
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-4">{title}</h2>
      <p className="text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}
