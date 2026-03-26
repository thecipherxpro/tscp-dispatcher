import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      // Check for PKCE code in query params
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && mounted) {
            setIsValidSession(true);
            setIsChecking(false);
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }
        } catch {
          // fall through
        }
      }

      // Check hash params (legacy)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      if (type === 'recovery' && accessToken) {
        if (mounted) {
          setIsValidSession(true);
          setIsChecking(false);
        }
        return;
      }

      // Check if already in a recovery session
      const { data: { session } } = await supabase.auth.getSession();
      if (session && mounted) {
        setIsValidSession(true);
        setIsChecking(false);
        return;
      }

      if (mounted) setIsChecking(false);
    };

    // Listen for auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
        setIsChecking(false);
      }
    });

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: "Passwords don't match", variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setIsSuccess(true);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to reset password', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1f1f] via-[#0d2b2b] to-[#0a1f1f] flex flex-col safe-area-inset">
        <div className="flex-1 flex flex-col justify-center px-6 py-12">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Password Updated!</h1>
              <p className="text-gray-400">Your password has been successfully reset. You can now sign in with your new password.</p>
            </div>
            <Button onClick={() => navigate('/auth')} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-xl font-semibold">
              Back to Sign In
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1f1f] via-[#0d2b2b] to-[#0a1f1f] flex flex-col safe-area-inset">
        <div className="flex-1 flex flex-col justify-center px-6 py-12 text-center space-y-6">
          <h1 className="text-2xl font-bold text-white">Invalid or Expired Link</h1>
          <p className="text-gray-400">This password reset link is invalid or has expired. Please request a new one.</p>
          <Button onClick={() => navigate('/auth')} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-xl font-semibold">
            Back to Sign In
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1f1f] via-[#0d2b2b] to-[#0a1f1f] flex flex-col safe-area-inset">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Set New Password</h1>
          <p className="text-gray-400 mt-2">Enter your new password below.</p>
        </div>

        <form onSubmit={handleReset} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-gray-300 text-sm font-medium">New Password</Label>
            <div className="relative">
              <Input id="newPassword" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-[#0d3535]/50 border-[#1a4a4a] text-white placeholder:text-gray-500 h-14 pr-12 rounded-xl focus:border-emerald-500" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword" className="text-gray-300 text-sm font-medium">Confirm Password</Label>
            <div className="relative">
              <Input id="confirmNewPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-[#0d3535]/50 border-[#1a4a4a] text-white placeholder:text-gray-500 h-14 pr-12 rounded-xl focus:border-emerald-500" required />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-xl font-semibold mt-4" disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Password'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </form>
      </div>
    </div>
  );
}
