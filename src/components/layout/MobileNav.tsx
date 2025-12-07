import { NavLink as RouterNavLink } from 'react-router-dom';
import { Home, Package, Users, Truck, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function MobileNav() {
  const { role } = useAuth();

  const adminLinks = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/orders', icon: Package, label: 'Orders' },
    { to: '/drivers', icon: Users, label: 'Drivers' },
    { to: '/track', icon: Truck, label: 'Track' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  const driverLinks = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/my-orders', icon: Package, label: 'Orders' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  const links = role === 'pharmacy_admin' ? adminLinks : driverLinks;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-bottom z-40">
      <div className="flex justify-around items-center h-16">
        {links.map((link) => (
          <RouterNavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <link.icon className="w-5 h-5 mb-1" />
            <span className="text-xs">{link.label}</span>
          </RouterNavLink>
        ))}
      </div>
    </nav>
  );
}
