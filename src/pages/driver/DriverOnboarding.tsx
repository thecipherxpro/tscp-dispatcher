import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, FileText, Shield, Database, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const steps = [
  { id: 'profile', title: 'Profile', icon: User },
  { id: 'terms', title: 'Terms', icon: FileText },
  { id: 'privacy', title: 'Privacy', icon: Shield },
  { id: 'data', title: 'Data', icon: Database },
];

export default function DriverOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, refreshProfile } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Profile data
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  
  // Agreements
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [dataDisclosureAccepted, setDataDisclosureAccepted] = useState(false);

  const canProceed = () => {
    switch (currentStep) {
      case 0: return fullName.trim().length >= 2 && dob && phone.length >= 10;
      case 1: return termsAccepted;
      case 2: return privacyAccepted;
      case 3: return dataDisclosureAccepted;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      // Save progress
      if (currentStep === 0) {
        await updateProfile({ onboarding_status: 'in_progress' });
      }
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      await completeOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateProfile = async (additionalData: Record<string, unknown> = {}) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        dob,
        phone,
        ...additionalData,
      })
      .eq('id', user.id);
    
    if (error) {
      console.error('Error updating profile:', error);
    }
  };

  const completeOnboarding = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          dob,
          phone,
          agreement_terms: termsAccepted,
          agreement_privacy: privacyAccepted,
          agreement_data_disclosure: dataDisclosureAccepted,
          onboarding_status: 'completed',
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      await refreshProfile();
      
      toast({
        title: "Welcome aboard!",
        description: "Your profile is complete. You're ready to start delivering.",
      });
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to complete onboarding. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground">Complete Your Profile</h2>
              <p className="text-muted-foreground text-sm mt-1">
                We need a few details to get you started
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
        );
      
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground">Terms of Service</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Please review and accept our terms
              </p>
            </div>
            
            <Card className="bg-muted/50 border-border max-h-48 overflow-y-auto">
              <CardContent className="p-4 text-sm text-muted-foreground">
                <p className="mb-2"><strong>1. Service Agreement</strong></p>
                <p className="mb-4">By accepting these terms, you agree to provide delivery services as an independent contractor for TSCP Dispatch. You will maintain all required licenses and insurance.</p>
                
                <p className="mb-2"><strong>2. Delivery Standards</strong></p>
                <p className="mb-4">You agree to handle all packages with care, maintain professional conduct, and follow all delivery protocols including signature collection where required.</p>
                
                <p className="mb-2"><strong>3. Confidentiality</strong></p>
                <p>You agree to keep all client information confidential and not share any personal health information with unauthorized parties.</p>
              </CardContent>
            </Card>
            
            <div className="flex items-start space-x-3 p-4 bg-card rounded-lg border border-border">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              />
              <label htmlFor="terms" className="text-sm text-foreground cursor-pointer">
                I have read and agree to the Terms of Service
              </label>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground">Privacy Policy</h2>
              <p className="text-muted-foreground text-sm mt-1">
                How we protect your information
              </p>
            </div>
            
            <Card className="bg-muted/50 border-border max-h-48 overflow-y-auto">
              <CardContent className="p-4 text-sm text-muted-foreground">
                <p className="mb-2"><strong>Data Collection</strong></p>
                <p className="mb-4">We collect your name, contact information, location data during deliveries, and delivery performance metrics.</p>
                
                <p className="mb-2"><strong>Data Usage</strong></p>
                <p className="mb-4">Your data is used to assign deliveries, optimize routes, process payments, and improve our services.</p>
                
                <p className="mb-2"><strong>Data Protection</strong></p>
                <p>All data is encrypted and stored securely in compliance with PHIPA regulations.</p>
              </CardContent>
            </Card>
            
            <div className="flex items-start space-x-3 p-4 bg-card rounded-lg border border-border">
              <Checkbox
                id="privacy"
                checked={privacyAccepted}
                onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
              />
              <label htmlFor="privacy" className="text-sm text-foreground cursor-pointer">
                I have read and agree to the Privacy Policy
              </label>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground">Data Disclosure</h2>
              <p className="text-muted-foreground text-sm mt-1">
                PHIPA compliance acknowledgment
              </p>
            </div>
            
            <Card className="bg-muted/50 border-border max-h-48 overflow-y-auto">
              <CardContent className="p-4 text-sm text-muted-foreground">
                <p className="mb-2"><strong>Health Information Protection</strong></p>
                <p className="mb-4">As a delivery driver handling pharmaceutical products, you may encounter personal health information (PHI). This includes patient names, addresses, and medication information.</p>
                
                <p className="mb-2"><strong>Your Responsibilities</strong></p>
                <p className="mb-4">You must never share, photograph, or disclose any client health information to anyone outside of authorized personnel.</p>
                
                <p className="mb-2"><strong>Breach Reporting</strong></p>
                <p>You must immediately report any suspected data breaches or security incidents to your supervisor.</p>
              </CardContent>
            </Card>
            
            <div className="flex items-start space-x-3 p-4 bg-card rounded-lg border border-border">
              <Checkbox
                id="data"
                checked={dataDisclosureAccepted}
                onCheckedChange={(checked) => setDataDisclosureAccepted(checked === true)}
              />
              <label htmlFor="data" className="text-sm text-foreground cursor-pointer">
                I acknowledge and agree to comply with PHIPA data handling requirements
              </label>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background safe-area-inset">
      <header className="bg-primary text-primary-foreground py-4 px-4 safe-area-top">
        <h1 className="text-lg font-bold">Driver Onboarding</h1>
        <p className="text-sm text-primary-foreground/70">Step {currentStep + 1} of {steps.length}</p>
      </header>

      {/* Progress Steps */}
      <div className="px-4 py-4">
        <div className="flex justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div key={step.id} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isCompleted 
                    ? 'bg-primary text-primary-foreground' 
                    : isActive 
                      ? 'bg-primary/20 text-primary border-2 border-primary' 
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs mt-1 ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Progress Line */}
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep) / (steps.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="px-4 py-4 flex-1">
        {renderStepContent()}
      </div>

      {/* Navigation Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 safe-area-bottom">
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isLoading}
            className="flex-1"
          >
            {isLoading ? 'Completing...' : currentStep === steps.length - 1 ? 'Complete' : 'Continue'}
            {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
