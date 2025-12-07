import { useState } from 'react';
import { User, Mail, Phone, Calendar, LogOut, Shield } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut();
    navigate('/auth');
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
    <AppLayout title="Profile">
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
            </div>
          </CardContent>
        </Card>

        <Button
          variant="destructive"
          className="w-full"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
        </Button>
      </div>
    </AppLayout>
  );
}
