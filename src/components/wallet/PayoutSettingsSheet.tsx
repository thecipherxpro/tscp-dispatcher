import { useState, useEffect } from 'react';
import { CreditCard, Building2, Mail, Check, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { usePayoutSettings } from '@/hooks/useDriverEarnings';
import { toast } from 'sonner';

interface PayoutSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CANADIAN_BANKS = [
  { name: 'TD Canada Trust', institution: '004', transit: '00000' },
  { name: 'Royal Bank of Canada (RBC)', institution: '003', transit: '00000' },
  { name: 'Scotiabank', institution: '002', transit: '00000' },
  { name: 'BMO Bank of Montreal', institution: '001', transit: '00000' },
  { name: 'CIBC', institution: '010', transit: '00000' },
  { name: 'National Bank of Canada', institution: '006', transit: '00000' },
  { name: 'Desjardins', institution: '815', transit: '00000' },
  { name: 'HSBC Canada', institution: '016', transit: '00000' },
  { name: 'Tangerine', institution: '614', transit: '00000' },
  { name: 'Simplii Financial', institution: '010', transit: '00000' },
];

export function PayoutSettingsSheet({ open, onOpenChange }: PayoutSettingsSheetProps) {
  const { settings, isLoading, saveSettings } = usePayoutSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('view');
  
  // Form state
  const [payoutMethod, setPayoutMethod] = useState<'e_transfer' | 'direct_deposit'>('e_transfer');
  
  // E-Transfer fields
  const [legalName, setLegalName] = useState('');
  const [bankName, setBankName] = useState('');
  const [eTransferEmail, setETransferEmail] = useState('');
  const [autoDeposit, setAutoDeposit] = useState('yes');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  
  // Direct Deposit fields
  const [institutionName, setInstitutionName] = useState('');
  const [transitNumber, setTransitNumber] = useState('');
  const [institutionNumber, setInstitutionNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  useEffect(() => {
    if (settings) {
      setPayoutMethod(settings.payout_method || 'e_transfer');
      setLegalName(settings.legal_name || '');
      setBankName(settings.bank_name || '');
      setETransferEmail(settings.e_transfer_email || '');
      setAutoDeposit(settings.auto_deposit ? 'yes' : 'no');
      setSecurityQuestion(settings.security_question || '');
      setSecurityAnswer(settings.security_answer || '');
      setInstitutionName(settings.institution_name || '');
      setTransitNumber(settings.transit_number || '');
      setInstitutionNumber(settings.institution_number || '');
      setAccountNumber(settings.account_number || '');
    }
  }, [settings]);

  const handleBankSelect = (bankName: string) => {
    const bank = CANADIAN_BANKS.find(b => b.name === bankName);
    if (bank) {
      setInstitutionName(bank.name);
      setInstitutionNumber(bank.institution);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    const payload = payoutMethod === 'e_transfer' 
      ? {
          payout_method: payoutMethod,
          legal_name: legalName,
          bank_name: bankName,
          e_transfer_email: eTransferEmail,
          auto_deposit: autoDeposit === 'yes',
          security_question: autoDeposit === 'no' ? securityQuestion : null,
          security_answer: autoDeposit === 'no' ? securityAnswer : null,
          // Clear direct deposit fields
          institution_name: null,
          transit_number: null,
          institution_number: null,
          account_number: null,
        }
      : {
          payout_method: payoutMethod,
          legal_name: legalName,
          institution_name: institutionName,
          transit_number: transitNumber,
          institution_number: institutionNumber,
          account_number: accountNumber,
          // Clear e-transfer fields
          bank_name: null,
          e_transfer_email: null,
          auto_deposit: null,
          security_question: null,
          security_answer: null,
        };
    
    const result = await saveSettings(payload);
    setIsSaving(false);
    
    if (result.success) {
      toast.success('Payout settings saved successfully');
      setActiveTab('view');
    } else {
      toast.error('Failed to save settings: ' + result.error);
    }
  };

  const maskEmail = (email: string) => {
    if (!email) return 'Not set';
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  };

  const maskAccount = (account: string) => {
    if (!account) return 'Not set';
    return `****${account.slice(-4)}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Payout Settings</SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="view">View</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="mt-4 space-y-4 overflow-y-auto pb-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !settings?.payout_method ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No payout method configured</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setActiveTab('settings')}
                >
                  Configure Now
                </Button>
              </div>
            ) : settings.payout_method === 'e_transfer' ? (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">E-Transfer</p>
                      <p className="text-xs text-muted-foreground">Interac e-Transfer deposit</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Legal Name</span>
                      <span className="text-sm font-medium text-foreground">{settings.legal_name || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Bank</span>
                      <span className="text-sm font-medium text-foreground">{settings.bank_name || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <span className="text-sm font-medium text-foreground">{maskEmail(settings.e_transfer_email)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Auto-Deposit</span>
                      <span className="text-sm font-medium text-foreground">{settings.auto_deposit ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Direct Deposit</p>
                      <p className="text-xs text-muted-foreground">Bank account transfer</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Legal Name</span>
                      <span className="text-sm font-medium text-foreground">{settings.legal_name || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Institution</span>
                      <span className="text-sm font-medium text-foreground">{settings.institution_name || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Transit #</span>
                      <span className="text-sm font-medium text-foreground">{settings.transit_number || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Account #</span>
                      <span className="text-sm font-medium text-foreground">{maskAccount(settings.account_number)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-6 overflow-y-auto pb-24">
            {/* Method Selection */}
            <div className="space-y-3">
              <Label>Payout Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPayoutMethod('e_transfer')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    payoutMethod === 'e_transfer' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <Mail className={`w-6 h-6 mx-auto mb-2 ${payoutMethod === 'e_transfer' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className={`text-sm font-medium ${payoutMethod === 'e_transfer' ? 'text-foreground' : 'text-muted-foreground'}`}>
                    E-Transfer
                  </p>
                </button>
                <button
                  onClick={() => setPayoutMethod('direct_deposit')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    payoutMethod === 'direct_deposit' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <Building2 className={`w-6 h-6 mx-auto mb-2 ${payoutMethod === 'direct_deposit' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className={`text-sm font-medium ${payoutMethod === 'direct_deposit' ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Direct Deposit
                  </p>
                </button>
              </div>
            </div>

            <Separator />

            {/* E-Transfer Form */}
            {payoutMethod === 'e_transfer' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="legalName">Legal Full Name</Label>
                  <Input
                    id="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="TD Canada Trust"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="eTransferEmail">E-Transfer Email</Label>
                  <Input
                    id="eTransferEmail"
                    type="email"
                    value={eTransferEmail}
                    onChange={(e) => setETransferEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label>Auto-Deposit</Label>
                  <RadioGroup value={autoDeposit} onValueChange={setAutoDeposit}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="auto-yes" />
                      <Label htmlFor="auto-yes" className="font-normal">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="auto-no" />
                      <Label htmlFor="auto-no" className="font-normal">No</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {autoDeposit === 'no' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="securityQuestion">Security Question</Label>
                      <Input
                        id="securityQuestion"
                        value={securityQuestion}
                        onChange={(e) => setSecurityQuestion(e.target.value)}
                        placeholder="What is your favorite color?"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="securityAnswer">Security Answer</Label>
                      <Input
                        id="securityAnswer"
                        type="password"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Direct Deposit Form */}
            {payoutMethod === 'direct_deposit' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ddLegalName">Legal Full Name</Label>
                  <Input
                    id="ddLegalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="institution">Bank Institution</Label>
                  <Select value={institutionName} onValueChange={handleBankSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your bank" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {CANADIAN_BANKS.map((bank) => (
                        <SelectItem key={bank.name} value={bank.name}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="transitNumber">Transit Number</Label>
                    <Input
                      id="transitNumber"
                      value={transitNumber}
                      onChange={(e) => setTransitNumber(e.target.value)}
                      placeholder="12345"
                      maxLength={5}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="institutionNumber">Institution #</Label>
                    <Input
                      id="institutionNumber"
                      value={institutionNumber}
                      onChange={(e) => setInstitutionNumber(e.target.value)}
                      placeholder="001"
                      maxLength={3}
                      disabled
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="1234567890"
                    maxLength={12}
                  />
                </div>
              </div>
            )}
            
            {/* Save Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="w-full"
                size="lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
