import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { MobileNav } from './MobileNav';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
}

export function AdminLayout({ 
  children, 
  title,
  showBackButton = false,
}: AdminLayoutProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-background safe-area-inset">
        {title && (
          <header className="sticky top-0 z-30 bg-card border-b border-border safe-area-top flex-shrink-0">
            <div className="px-4 py-3 flex items-center gap-3">
              {showBackButton && (
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
            </div>
          </header>
        )}
        <main className="flex-1 overflow-y-auto pb-20">{children}</main>
        <MobileNav />
      </div>
    );
  }

  // Desktop Layout with Sidebar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <SidebarInset className="flex-1">
          {/* Desktop Header */}
          <header className="sticky top-0 z-30 bg-card border-b border-border">
            <div className="flex h-14 items-center gap-4 px-6">
              <SidebarTrigger className="-ml-1">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <Separator orientation="vertical" className="h-6" />
              {showBackButton && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              {title && <h1 className="text-lg font-semibold text-foreground">{title}</h1>}
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
