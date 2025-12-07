import { ReactNode } from 'react';
import { MobileNav } from './MobileNav';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
}

export function AppLayout({ children, title, showNav = true }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background safe-area-inset">
      {title && (
        <header className="sticky top-0 z-30 bg-card border-b border-border safe-area-top">
          <div className="px-4 py-4">
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
