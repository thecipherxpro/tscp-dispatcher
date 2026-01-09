import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Truck, Calendar, Phone, User, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { AppRole } from '@/types/auth';

interface UserWithRoles {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  driver_id: string | null;
  created_at: string | null;
  onboarding_status: string | null;
  dob?: string | null;
  roles: AppRole[];
}

interface UserProfileEditSheetProps {
  user: UserWithRoles | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
}

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Shield; variant: 'default' | 'secondary' | 'outline' }> = {
  pharmacy_admin: { label: 'Admin', icon: Shield, variant: 'default' },
  driver: { label: 'Driver', icon: Truck, variant: 'secondary' },
};

export function UserProfileEditSheet({ user, open, onOpenChange, onUserUpdated }: UserProfileEditSheetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [driverProfile, setDriverProfile] = useState<{
    dob: string | null;
  } | null>(null);

  useEffect(() => {
    if (user && open) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      fetchFullProfile();
    }
  }, [user, open]);

  const fetchFullProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setDob(data.dob || '');
        setDriverProfile({
          dob: data.dob,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          dob: dob || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      onUserUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
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

  const getOnboardingBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Edit User Profile</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[calc(85vh-8rem)] space-y-6 pb-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground">
                  {user.full_name || 'Unnamed User'}
                </h3>
                {user.driver_id && (
                  <p className="text-sm text-muted-foreground">{user.driver_id}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {user.roles.map(role => {
                    const config = ROLE_CONFIG[role];
                    const Icon = config.icon;
                    return (
                      <Badge key={role} variant={config.variant} className="gap-1 text-xs">
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>

            <Separator />

            {/* Status Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Onboarding Status</p>
                {getOnboardingBadge(user.onboarding_status)}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Joined</p>
                <p className="text-sm font-medium text-foreground">
                  {user.created_at ? format(new Date(user.created_at), 'MMM dd, yyyy') : 'N/A'}
                </p>
              </div>
            </div>

            <Separator />

            {/* Editable Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Date of Birth
                </Label>
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            <Separator />

            {/* Save Button */}
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
