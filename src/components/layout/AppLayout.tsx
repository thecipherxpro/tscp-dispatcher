import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MobileNav } from './MobileNav';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
  showBackButton?: boolean;
}

export function AppLayout({ children, title, showNav = true, showBackButton = false }: AppLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-area-inset">
      {title && (
        <header className="sticky top-0 z-30 bg-card border-b border-border safe-area-top">
          <div className="px-4 py-4 flex items-center gap-3">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
          </div>
        </header>
      )}
      <main className={`${showNav ? 'pb-20' : ''} ${title ? '' : 'pt-safe'}`}>
        {children}
      </main>
      {showNav && <MobileNav />}
    </div>
  );
}
