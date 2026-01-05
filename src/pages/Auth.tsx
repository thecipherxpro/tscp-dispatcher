import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import endoverdoseLogo from '@/assets/endoverdose-logo.png';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AuthStep = 'login' | 'signup' | 'success';

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();
  
  const [step, setStep] = useState<AuthStep>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Signup fields
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
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        navigate('/');
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = signUpSchema.safeParse({ 
        fullName, 
        email, 
        phone, 
        password, 
        confirmPassword, 
        agreeToTerms 
      });
      
      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setStep('success');
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Success confirmation screen
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1f1f] via-[#0d2b2b] to-[#0a1f1f] flex flex-col safe-area-inset">
        <div className="flex-1 flex flex-col justify-center px-6 py-12">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Account Created!</h1>
              <p className="text-gray-400">Your account has been successfully created.</p>
            </div>

            <div className="bg-[#0d3535]/50 border border-[#1a4a4a] rounded-xl p-6 space-y-4 text-left">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-white">Pending Approval</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Your account is currently pending approval from an administrator. You will be notified once your account has been activated.
                  </p>
                </div>
              </div>
              
              <div className="border-t border-[#1a4a4a] pt-4">
                <p className="text-sm text-gray-400">
                  <span className="text-emerald-400 font-medium">What happens next?</span>
                </p>
                <ul className="text-sm text-gray-400 mt-2 space-y-1">
                  <li>• An admin will review your application</li>
                  <li>• You'll receive access to the driver portal once approved</li>
                  <li>• This usually takes 1-2 business days</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={() => {
                setStep('login');
                setEmail('');
                setPassword('');
                setFullName('');
                setPhone('');
                setConfirmPassword('');
                setAgreeToTerms(false);
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-xl font-semibold"
            >
              Back to Sign In
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Signup screen
  if (step === 'signup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1f1f] via-[#0d2b2b] to-[#0a1f1f] flex flex-col safe-area-inset">
        <div className="px-6 pt-12">
          <button
            onClick={() => setStep('login')}
            className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white">Create Account</h1>
            <p className="text-gray-400 mt-2">
              Sign up to start delivering vital supplies to those in need.
            </p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-5 flex-1">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-gray-300 text-sm font-medium">Full Name</Label>
              <div className="relative">
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Dr. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-[#0d3535]/50 border-[#1a4a4a] text-white placeholder:text-gray-500 h-14 pr-12 rounded-xl focus:border-emerald-500"
                  required
                />
                <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="signupEmail" className="text-gray-300 text-sm font-medium">Email</Label>
              <div className="relative">
                <Input
                  id="signupEmail"
                  type="email"
                  placeholder="john@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#0d3535]/50 border-[#1a4a4a] text-white placeholder:text-gray-500 h-14 pr-12 rounded-xl focus:border-emerald-500"
                  required
                />
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-300 text-sm font-medium">Phone Number</Label>
              <div className="relative flex">
                <div className="flex items-center px-4 bg-[#0d3535]/50 border border-[#1a4a4a] border-r-0 rounded-l-xl text-gray-400">
                  +1
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-[#0d3535]/50 border-[#1a4a4a] text-white placeholder:text-gray-500 h-14 pr-12 rounded-l-none rounded-r-xl focus:border-emerald-500"
                  required
                />
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="signupPassword" className="text-gray-300 text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="signupPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#0d3535]/50 border-[#1a4a4a] text-white placeholder:text-gray-500 h-14 pr-12 rounded-xl focus:border-emerald-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-300 text-sm font-medium">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-[#0d3535]/50 border-[#1a4a4a] text-white placeholder:text-gray-500 h-14 pr-12 rounded-xl focus:border-emerald-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="terms"
                checked={agreeToTerms}
                onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                className="mt-0.5 border-[#1a4a4a] data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
              <Label htmlFor="terms" className="text-sm text-gray-400 leading-relaxed">
                I agree to the{' '}
                <span className="text-emerald-400 hover:underline cursor-pointer">Terms of Service</span>
                {' '}and{' '}
                <span className="text-emerald-400 hover:underline cursor-pointer">Privacy Policy</span>.
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-xl font-semibold mt-4"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </form>

          <div className="mt-6 text-center pb-6">
            <p className="text-gray-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setStep('login')}
                className="text-emerald-400 hover:underline font-medium"
              >
                Log In
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Login screen (default)
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1f1f] via-[#0d2b2b] to-[#0a1f1f] flex flex-col safe-area-inset">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="mb-8">
          <div className="w-48 h-12 mb-6">
            <img src={endoverdoseLogo} alt="EndOverdose" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Welcome<br />Back
          </h1>
          <p className="text-gray-400 mt-3">
            Sign in securely to access your medical delivery dashboard.
          </p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-300 text-sm font-medium uppercase tracking-wide">
              Email Address
            </Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="nurse@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#0d3535]/50 border-[#1a4a4a] text-white placeholder:text-gray-500 h-14 pr-12 rounded-xl focus:border-emerald-500"
                required
              />
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-gray-300 text-sm font-medium uppercase tracking-wide">
                Password
              </Label>
              <button type="button" className="text-emerald-400 text-sm hover:underline">
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#0d3535]/50 border-[#1a4a4a] text-white placeholder:text-gray-500 h-14 pr-12 rounded-xl focus:border-emerald-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-white hover:bg-gray-100 text-[#0a1f1f] py-6 rounded-xl font-semibold mt-6"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </form>

        <div className="mt-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1a4a4a]" />
            </div>
          </div>
          <p className="text-gray-400 mt-6">
            New to the platform?{' '}
            <button
              type="button"
              onClick={() => setStep('signup')}
              className="text-emerald-400 hover:underline font-medium"
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
