import { useState } from 'react';
import { FileDown, Truck, CheckCircle2, ArrowRight, ArrowLeft, Calendar, Clock, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CustomOrder } from '@/hooks/useCustomOrders';
import { generateCustomLabels, LabelOptions } from '@/utils/customLabelGenerator';

interface CustomLabelGeneratorSheetProps {
  orders: CustomOrder[];
  isOpen: boolean;
  onClose: () => void;
}

type LabelType = 'standard' | 'shipped' | 'completed';
type Step = 'select-type' | 'date-selection' | 'generating';

export function CustomLabelGeneratorSheet({ orders, isOpen, onClose }: CustomLabelGeneratorSheetProps) {
  const [step, setStep] = useState<Step>('select-type');
  const [labelType, setLabelType] = useState<LabelType>('standard');
  const [shippedDate, setShippedDate] = useState(new Date().toISOString().split('T')[0]);
  const [shippedTime, setShippedTime] = useState('09:00');
  const [deliveredDate, setDeliveredDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveredTime, setDeliveredTime] = useState('14:00');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleClose = () => {
    setStep('select-type');
    setLabelType('standard');
    setIsGenerating(false);
    setProgress(0);
    onClose();
  };

  const handleSelectType = (type: LabelType) => {
    setLabelType(type);
    if (type === 'standard') {
      handleGenerate(type);
    } else {
      setStep('date-selection');
    }
  };

  const handleGenerate = async (type: LabelType = labelType) => {
    setStep('generating');
    setIsGenerating(true);
    setProgress(0);

    const options: LabelOptions = {
      type,
      shippedAt: type !== 'standard' ? `${shippedDate}T${shippedTime}:00` : undefined,
      deliveredAt: type === 'completed' ? `${deliveredDate}T${deliveredTime}:00` : undefined,
    };

    try {
      await generateCustomLabels(orders, options, (p) => setProgress(p));
    } finally {
      setIsGenerating(false);
      handleClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            Generate Labels
            <Badge variant="secondary" className="ml-2">
              {orders.length} order{orders.length !== 1 ? 's' : ''}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Step 1: Select Label Type */}
          {step === 'select-type' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose the type of label to generate:
              </p>

              {/* Standard */}
              <Card
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleSelectType('standard')}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileDown className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">Generate and Download Labels</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Standard labels without shipped/delivered dates
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>

              {/* Shipped */}
              <Card
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleSelectType('shipped')}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">Mark Shipped and Download</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Labels with shipped date/time included
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>

              {/* Completed */}
              <Card
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleSelectType('completed')}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">Mark Shipped & Delivered</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Labels + 4x6" receipt with delivered stamp
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Date Selection */}
          {step === 'date-selection' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">
                  {labelType === 'shipped' ? 'Shipped Labels' : 'Completed Labels'}
                </Badge>
              </div>

              {/* Shipped Date/Time */}
              <div className="space-y-4">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Shipped Date & Time
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={shippedDate}
                        onChange={(e) => setShippedDate(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={shippedTime}
                        onChange={(e) => setShippedTime(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivered Date/Time (only for completed) */}
              {labelType === 'completed' && (
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Delivered Date & Time
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Date</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={deliveredDate}
                          onChange={(e) => setDeliveredDate(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="time"
                          value={deliveredTime}
                          onChange={(e) => setDeliveredTime(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-foreground mb-2">Label Preview</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Shipped: {new Date(`${shippedDate}T${shippedTime}`).toLocaleString()}</p>
                    {labelType === 'completed' && (
                      <>
                        <p>• Delivered: {new Date(`${deliveredDate}T${deliveredTime}`).toLocaleString()}</p>
                        <p className="text-primary font-medium">• 4x6" delivery receipt will also be generated</p>
                        <p className="text-green-600 font-medium">• Delivered stamp on receipt only</p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Generating */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="font-medium text-foreground">Generating labels...</p>
              <Progress value={progress} className="w-full max-w-xs" />
              <p className="text-sm text-muted-foreground">{progress}% complete</p>
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border pt-4">
          {step === 'select-type' && (
            <Button variant="outline" onClick={handleClose} className="w-full">
              Cancel
            </Button>
          )}

          {step === 'date-selection' && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setStep('select-type')} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => handleGenerate()} className="flex-1">
                Generate {orders.length} Label{orders.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
