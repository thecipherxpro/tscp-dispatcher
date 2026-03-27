import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle, Clock, Truck, ShieldCheck, BarChart3, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import medexpressLogo from '@/assets/logo.png';
import medexpressLogoDark from '@/assets/logo-dark.png';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms')
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type AuthStep = 'login' | 'signup' | 'success' | 'forgot';

const features = [
  { icon: Truck, title: 'Real-Time Tracking', description: 'Track deliveries in real-time with GPS coordinates and status updates' },
  { icon: Package, title: 'Driver Management', description: 'Assign orders, manage driver zones, and monitor performance' },
  { icon: ShieldCheck, title: 'Order Management', description: 'Create, edit, and track pharmaceutical orders with complete audit trails' },
  { icon: BarChart3, title: 'Analytics & Reports', description: 'Comprehensive dashboards and reporting for business insights' },
];

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();
  const [step, setStep] = useState<AuthStep>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const [email, setEmail] = useState(() => localStorage.getItem('rememberedEmail') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('rememberedEmail'));

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validation = authSchema.safeParse({ email, password });
      if (!validation.success) {
        toast({ title: "Validation Error", description: validation.error.errors[0].message, variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Sign In Failed", description: error.message, variant: "destructive" });
      } else {
        if (rememberMe) localStorage.setItem('rememberedEmail', email);
        else localStorage.removeItem('rememberedEmail');
        navigate('/');
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validation = signUpSchema.safeParse({ fullName, email, phone, password, confirmPassword, agreeToTerms });
      if (!validation.success) {
        toast({ title: "Validation Error", description: validation.error.errors[0].message, variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast({ title: "Sign Up Failed", description: error.message, variant: "destructive" });
      } else {
        setStep('success');
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Branding sidebar (desktop only)
  const BrandingSidebar = () => (
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-[hsl(193,75%,18%)] to-[hsl(193,88%,10%)] flex-col justify-between p-10 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        <img src={medexpressLogo} alt="KitKin Express" className="h-32 w-auto mb-4" />
        <p className="text-white/70 mt-3 text-lg">
          Pharmaceutical Delivery Management System
        </p>
      </div>

      <div className="relative z-10 space-y-2">
        <h2 className="text-xl font-bold text-white mb-6">Key Features</h2>
        <div className="space-y-5">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="text-white/60 text-sm">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <p className="text-white/50 text-sm">Secure pharmaceutical delivery dispatch platform</p>
        <p className="text-white/40 text-xs mt-1">© {new Date().getFullYear()} KitKin Express. All rights reserved.</p>
      </div>
    </div>
  );

  // Success screen
  if (step === 'success') {
    return (
      <div className="min-h-screen flex">
        <BrandingSidebar />
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-background">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Account Created!</h1>
              <p className="text-muted-foreground">Your account has been successfully created.</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 text-left">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Pending Approval</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your account is currently pending approval from an administrator.
                  </p>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-sm text-primary font-medium">What happens next?</p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• An admin will review your application</li>
                  <li>• You'll receive access to the driver portal once approved</li>
                  <li>• This usually takes 1-2 business days</li>
                </ul>
              </div>
            </div>
            <Button onClick={() => { setStep('login'); setEmail(''); setPassword(''); setFullName(''); setPhone(''); setConfirmPassword(''); setAgreeToTerms(false); }} className="w-full py-6 rounded-xl font-semibold">
              Back to Sign In <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password screen
  if (step === 'forgot') {
    const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setForgotSent(true);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message || 'Failed to send reset email', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    if (forgotSent) {
      return (
        <div className="min-h-screen flex">
          <BrandingSidebar />
          <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-background">
            <div className="w-full max-w-md text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Mail className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Check Your Email</h1>
                <p className="text-muted-foreground">We've sent a password reset link to <span className="text-primary font-medium">{forgotEmail}</span>.</p>
              </div>
              <Button onClick={() => { setStep('login'); setForgotSent(false); setForgotEmail(''); }} className="w-full py-6 rounded-xl font-semibold">
                Back to Sign In <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex">
        <BrandingSidebar />
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-background">
          <div className="w-full max-w-md">
            <button onClick={() => setStep('login')} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-3xl font-bold text-foreground">Forgot Password</h1>
            <p className="text-muted-foreground mt-2 mb-8">Enter your email and we'll send you a reset link.</p>
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="forgotEmail" className="text-sm font-medium uppercase tracking-wide">Email Address</Label>
                <div className="relative">
                  <Input id="forgotEmail" type="email" placeholder="nurse@hospital.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="h-14 pr-12 rounded-xl" required />
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <Button type="submit" className="w-full py-6 rounded-xl font-semibold" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Signup screen
  if (step === 'signup') {
    return (
      <div className="min-h-screen flex">
        <BrandingSidebar />
        <div className="flex-1 flex flex-col items-center px-6 py-8 bg-background overflow-y-auto">
          <div className="w-full max-w-md">
            <button onClick={() => setStep('login')} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="w-6 h-6" />
            </button>
            {/* Mobile logo */}
            <div className="lg:hidden mb-6">
              <img src={medexpressLogoDark} alt="KitKin Express" className="h-14 w-auto" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Create Account</h1>
            <p className="text-muted-foreground mt-2 mb-6">Sign up to start delivering vital supplies.</p>
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium uppercase tracking-wide">Full Name</Label>
                <div className="relative">
                  <Input id="fullName" type="text" placeholder="Dr. John Doe" value={fullName} onChange={e => setFullName(e.target.value)} className="h-14 pr-12 rounded-xl" required />
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signupEmail" className="text-sm font-medium uppercase tracking-wide">Email</Label>
                <div className="relative">
                  <Input id="signupEmail" type="email" placeholder="john@hospital.com" value={email} onChange={e => setEmail(e.target.value)} className="h-14 pr-12 rounded-xl" required />
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium uppercase tracking-wide">Phone Number</Label>
                <div className="relative flex">
                  <div className="flex items-center px-4 bg-muted border border-input border-r-0 rounded-l-xl text-muted-foreground">+1</div>
                  <Input id="phone" type="tel" placeholder="(555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} className="h-14 pr-12 rounded-l-none rounded-r-xl" required />
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signupPassword" className="text-sm font-medium uppercase tracking-wide">Password</Label>
                <div className="relative">
                  <Input id="signupPassword" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-14 pr-12 rounded-xl" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium uppercase tracking-wide">Confirm Password</Label>
                <div className="relative">
                  <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-14 pr-12 rounded-xl" required />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-2">
                <Checkbox id="terms" checked={agreeToTerms} onCheckedChange={checked => setAgreeToTerms(checked === true)} className="mt-0.5" />
                <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
                  I agree to the <span className="text-primary hover:underline cursor-pointer">Terms of Service</span> and <span className="text-primary hover:underline cursor-pointer">Privacy Policy</span>.
                </Label>
              </div>
              <Button type="submit" className="w-full py-6 rounded-xl font-semibold mt-4" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Create Account'} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
            <div className="mt-6 text-center pb-6">
              <p className="text-muted-foreground">
                Already have an account? <button type="button" onClick={() => setStep('login')} className="text-primary hover:underline font-medium">Log In</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login screen (default) — split layout on desktop
  return (
    <div className="min-h-screen flex">
      <BrandingSidebar />
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
             <img src={medexpressLogoDark} alt="KitKin Express" className="h-14 w-auto mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground italic -rotate-1">KitKin Express Dispatch</h1>
            <p className="text-muted-foreground mt-1">Pharmaceutical Delivery Management System</p>
          </div>

          <div className="space-y-2 mb-8 hidden lg:block">
            <h1 className="text-3xl font-bold text-foreground">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in securely to access your delivery dashboard.</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium uppercase tracking-wide">Email Address</Label>
              <div className="relative">
                <Input id="email" type="email" placeholder="nurse@hospital.com" value={email} onChange={e => setEmail(e.target.value)} className="h-14 pr-12 rounded-xl" required />
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium uppercase tracking-wide">Password</Label>
                <button type="button" onClick={() => setStep('forgot')} className="text-primary text-sm hover:underline font-medium">Forgot?</button>
              </div>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} className="h-14 pr-12 rounded-xl" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Checkbox id="rememberMe" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
              <Label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer">Remember me</Label>
            </div>

            <Button type="submit" className="w-full py-6 rounded-xl font-semibold mt-4" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'} <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </form>

          <div className="mt-8 text-center">
            <div className="w-full border-t border-border" />
            <p className="text-muted-foreground mt-6">
              New to the platform? <button type="button" onClick={() => setStep('signup')} className="text-primary hover:underline font-medium">Create Account</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
