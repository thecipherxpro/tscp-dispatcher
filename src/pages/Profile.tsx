import { useState } from 'react';
import { User, Mail, Phone, Calendar, LogOut, Shield, Edit2, Save, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { user, profile, role, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [dob, setDob] = useState(profile?.dob || '');

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut();
    navigate('/auth');
  };

  const handleEdit = () => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    setDob(profile?.dob || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
          dob: dob || null,
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      await refreshProfile();
      setIsEditing(false);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <AppLayout title="Profile" showBackButton>
      <div className="p-4 space-y-6">
        <div className="flex flex-col items-center py-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.full_name || 'User'} 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-primary" />
            )}
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {profile?.full_name || 'User'}
          </h2>
          <div className="flex items-center mt-1 text-muted-foreground">
            <Shield className="w-4 h-4 mr-1" />
            <span className="text-sm capitalize">
              {role?.replace('_', ' ') || 'Unknown Role'}
            </span>
          </div>
        </div>

        {isEditing ? (
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Full Name</Label>
                <Input
                  id="editName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editPhone">Phone</Label>
                <Input
                  id="editPhone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editDob">Date of Birth</Label>
                <Input
                  id="editDob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={handleCancel} disabled={isSaving}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-0 divide-y divide-border">
                <div className="flex items-center p-4">
                  <Mail className="w-5 h-5 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-foreground">{user?.email || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center p-4">
                  <Phone className="w-5 h-5 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-foreground">{profile?.phone || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center p-4">
                  <Calendar className="w-5 h-5 text-muted-foreground mr-3" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date of Birth</p>
                    <p className="text-foreground">{formatDate(profile?.dob || null)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button variant="outline" className="w-full" onClick={handleEdit}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </>
        )}

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <h3 className="font-medium text-foreground mb-3">Account Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Onboarding</span>
                <span className="text-foreground capitalize">
                  {profile?.onboarding_status?.replace('_', ' ') || 'Not started'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Terms Accepted</span>
                <span className={profile?.agreement_terms ? 'text-green-600' : 'text-destructive'}>
                  {profile?.agreement_terms ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Privacy Accepted</span>
                <span className={profile?.agreement_privacy ? 'text-green-600' : 'text-destructive'}>
                  {profile?.agreement_privacy ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Disclosure</span>
                <span className={profile?.agreement_data_disclosure ? 'text-green-600' : 'text-destructive'}>
                  {profile?.agreement_data_disclosure ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button variant="destructive" className="w-full" onClick={handleLogout} disabled={isLoggingOut}>
          <LogOut className="w-4 h-4 mr-2" />
          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
        </Button>
      </div>
    </AppLayout>
  );
}
