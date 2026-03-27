import { useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Edit, Tag, MapPin, Truck, Users, FileText, Settings, DollarSign, FileSpreadsheet, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
const mainNavItems = [{
  to: '/dashboard',
  icon: LayoutDashboard,
  label: 'Dashboard'
}, {
  to: '/orders',
  icon: Package,
  label: 'Orders'
}, {
  to: '/admin/custom-orders',
  icon: Package,
  label: 'Custom Orders'
}, {
  to: '/admin/order-edits',
  icon: Edit,
  label: 'Order Edits'
}, {
  to: '/package-labels',
  icon: Tag,
  label: 'Package Labels'
}];
const managementItems = [{
  to: '/track',
  icon: MapPin,
  label: 'Tracking'
}, {
  to: '/drivers',
  icon: Truck,
  label: 'Drivers'
}, {
  to: '/users',
  icon: Users,
  label: 'Users'
}, {
  to: '/audit',
  icon: FileText,
  label: 'Audit Trail'
}];
const settingsItems = [{
  to: '/admin/payroll',
  icon: DollarSign,
  label: 'Payroll'
}, {
  to: '/admin/import-templates',
  icon: FileSpreadsheet,
  label: 'Import Templates'
}, {
  to: '/settings',
  icon: Settings,
  label: 'Settings'
}];
export function AdminSidebar() {
  const {
    state
  } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const {
    profile,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };
  const isActive = (path: string) => location.pathname === path;
  return <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Package className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && <div className="flex flex-col">
              <span className="font-semibold text-foreground">KitKin Express</span>
              <span className="text-xs text-muted-foreground">Admin Portal</span>
            </div>}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map(item => <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)}>
                    <NavLink to={item.to} className="flex items-center gap-3" activeClassName="bg-primary/10 text-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management */}
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map(item => <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)}>
                    <NavLink to={item.to} className="flex items-center gap-3" activeClassName="bg-primary/10 text-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map(item => <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)}>
                    <NavLink to={item.to} className="flex items-center gap-3" activeClassName="bg-primary/10 text-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto">
        <Separator className="mb-4" />
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground text-sm">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.full_name || 'Admin'}
              </p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>}
        </div>
        <button onClick={handleLogout} className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors w-full ${collapsed ? 'justify-center' : ''}`}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="text-sm">Log out</span>}
        </button>
      </SidebarFooter>
    </Sidebar>;
}