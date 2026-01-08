import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { NavLink } from '@/components/NavLink';
import { 
  Menu, 
  LayoutDashboard, 
  Package, 
  Edit, 
  Tag, 
  Truck, 
  Settings, 
  MapPin,
  Users,
  FileText
} from 'lucide-react';
import { useState } from 'react';

const adminNavItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/orders', icon: Package, label: 'Orders' },
  { to: '/admin/order-edits', icon: Edit, label: 'Order Edits' },
  { to: '/admin/labels', icon: Tag, label: 'Package Labels' },
  { to: '/admin/tracking', icon: MapPin, label: 'Tracking' },
  { to: '/admin/drivers', icon: Truck, label: 'Drivers' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/audit', icon: FileText, label: 'Audit Trail' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

interface DesktopNavProps {
  title?: string;
}

export function DesktopNav({ title }: DesktopNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] sm:w-[320px]">
        <SheetHeader>
          <SheetTitle className="text-left">{title || 'Admin Menu'}</SheetTitle>
        </SheetHeader>
        <Separator className="my-4" />
        <nav className="flex flex-col gap-1">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              activeClassName="bg-primary/10 text-primary font-medium"
              onClick={() => setOpen(false)}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
