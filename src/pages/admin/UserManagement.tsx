import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, UserCog, Shield, Truck, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppRole } from '@/types/auth';

interface UserWithRoles {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  driver_id: string | null;
  created_at: string | null;
  onboarding_status: string | null;
  roles: AppRole[];
}

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Shield; variant: 'default' | 'secondary' | 'outline' }> = {
  pharmacy_admin: { label: 'Admin', icon: Shield, variant: 'default' },
  driver: { label: 'Driver', icon: Truck, variant: 'secondary' },
};

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        phone: profile.phone,
        avatar_url: profile.avatar_url,
        driver_id: profile.driver_id,
        created_at: profile.created_at,
        onboarding_status: profile.onboarding_status,
        roles: (roles || [])
          .filter(r => r.user_id === profile.id)
          .map(r => r.role as AppRole),
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.phone?.toLowerCase().includes(query) ||
      user.driver_id?.toLowerCase().includes(query)
    );
  });

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.id,
          role: selectedRole,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('User already has this role');
        } else {
          throw error;
        }
      } else {
        toast.success(`Added ${ROLE_CONFIG[selectedRole].label} role`);
        await fetchUsers();
      }
    } catch (error) {
      console.error('Error adding role:', error);
      toast.error('Failed to add role');
    } finally {
      setIsUpdating(false);
      setIsRoleDialogOpen(false);
      setSelectedRole('');
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      toast.success(`Removed ${ROLE_CONFIG[role].label} role`);
      await fetchUsers();
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error('Failed to remove role');
    } finally {
      setIsUpdating(false);
    }
  };

  const openRoleDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRole('');
    setIsRoleDialogOpen(true);
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const availableRoles = selectedUser
    ? (Object.keys(ROLE_CONFIG) as AppRole[]).filter(
        role => !selectedUser.roles.includes(role)
      )
    : [];

  // Mobile card view for users
  const UserCard = ({ user }: { user: UserWithRoles }) => (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {user.full_name || 'Unnamed User'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.phone || 'No phone'}
                </p>
                {user.driver_id && (
                  <p className="text-xs text-muted-foreground">
                    {user.driver_id}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-8 px-2"
                onClick={() => openRoleDialog(user)}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:ml-1">Add</span>
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {user.roles.length === 0 ? (
                <span className="text-xs text-muted-foreground">No roles assigned</span>
              ) : (
                user.roles.map(role => {
                  const config = ROLE_CONFIG[role];
                  const Icon = config.icon;
                  return (
                    <Badge
                      key={role}
                      variant={config.variant}
                      className="gap-1 text-xs py-0.5"
                    >
                      <Icon className="h-3 w-3" />
                      {config.label}
                      <button
                        onClick={() => handleRemoveRole(user.id, role)}
                        className="ml-0.5 hover:text-destructive transition-colors"
                        disabled={isUpdating}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout title="User Management" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Header */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserCog className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-sm sm:text-base">User Management</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {users.length} registered users
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-10"
          />
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-14" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card className="border-border">
            <CardContent className="p-8 text-center">
              <UserCog className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No users found</p>
              {searchQuery && (
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different search term
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="space-y-3 md:hidden">
              {filteredUsers.map(user => (
                <UserCard key={user.id} user={user} />
              ))}
            </div>

            {/* Desktop Table View */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map(user => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {getInitials(user.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">
                                  {user.full_name || 'Unnamed User'}
                                </p>
                                {user.driver_id && (
                                  <p className="text-xs text-muted-foreground">
                                    {user.driver_id}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground">
                              {user.phone || 'No phone'}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.roles.length === 0 ? (
                                <span className="text-xs text-muted-foreground">No roles</span>
                              ) : (
                                user.roles.map(role => {
                                  const config = ROLE_CONFIG[role];
                                  const Icon = config.icon;
                                  return (
                                    <Badge
                                      key={role}
                                      variant={config.variant}
                                      className="gap-1 text-xs"
                                    >
                                      <Icon className="h-3 w-3" />
                                      {config.label}
                                      <button
                                        onClick={() => handleRemoveRole(user.id, role)}
                                        className="ml-1 hover:text-destructive"
                                        disabled={isUpdating}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </Badge>
                                  );
                                })
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRoleDialog(user)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Role
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Add Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Add Role</DialogTitle>
            <DialogDescription>
              Assign a new role to {selectedUser?.full_name || 'this user'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedRole}
              onValueChange={value => setSelectedRole(value as AppRole)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {availableRoles.map(role => {
                  const config = ROLE_CONFIG[role];
                  const Icon = config.icon;
                  return (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {availableRoles.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                This user already has all available roles
              </p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleAddRole}
              disabled={!selectedRole || isUpdating}
              className="w-full sm:w-auto"
            >
              {isUpdating ? 'Adding...' : 'Add Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
