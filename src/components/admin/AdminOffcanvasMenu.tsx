import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, 
  FileText, 
  MapPin, 
  Users, 
  Truck, 
  History,
  DollarSign,
  LogOut
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const menuItems = [
  { to: '/admin/payroll', icon: DollarSign, label: 'Payroll' },
  { to: '/track', icon: MapPin, label: 'Tracking List' },
  { to: '/drivers', icon: Truck, label: 'Drivers' },
  { to: '/users', icon: Users, label: 'User Management' },
  { to: '/audit', icon: History, label: 'Audit Trail' },
];

export function AdminOffcanvasMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavigate = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] bg-card border-border">
        <SheetHeader>
          <SheetTitle className="text-left text-foreground">Admin Menu</SheetTitle>
        </SheetHeader>
        <Separator className="my-4" />
        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => (
            <button
              key={item.to}
              onClick={() => handleNavigate(item.to)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left w-full"
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <Separator className="my-4" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors text-left w-full"
        >
          <LogOut className="h-5 w-5" />
          <span>Log out</span>
        </button>
      </SheetContent>
    </Sheet>
  );
}
