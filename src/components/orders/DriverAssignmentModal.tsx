import { useState } from 'react';
import { Truck, User, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Order } from '@/types/auth';
import { useDrivers, assignDriverToOrder } from '@/hooks/useOrders';
import { useToast } from '@/hooks/use-toast';

interface DriverAssignmentModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DriverAssignmentModal({ order, isOpen, onClose, onSuccess }: DriverAssignmentModalProps) {
  const { toast } = useToast();
  const { drivers, isLoading } = useDrivers();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  if (!order) return null;

  const handleAssign = async () => {
    if (!selectedDriverId) {
      toast({
        title: "Select a driver",
        description: "Please select a driver to assign this order.",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);

    const result = await assignDriverToOrder(
      order.id,
      selectedDriverId,
      order.client_name,
      {
        doses_nasal: order.doses_nasal,
        nasal_rx: order.nasal_rx,
        doses_injectable: order.doses_injectable,
        injection_rx: order.injection_rx,
        city: order.city,
        province: order.province,
        postal_code: order.postal_code,
        country: order.country,
        pending_at: order.pending_at,
      }
    );

    setIsAssigning(false);

    if (result.success) {
      toast({
        title: "Driver Assigned",
        description: "The order has been assigned and tracking URL generated.",
      });
      onSuccess();
    } else {
      toast({
        title: "Assignment Failed",
        description: result.error || "Failed to assign driver.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Assign Driver
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Assigning to</p>
            <p className="font-medium text-foreground">{order.client_name || 'Unknown Client'}</p>
            <p className="text-sm text-muted-foreground">
              {order.city}, {order.province}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : drivers.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <User className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No drivers available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {drivers.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => setSelectedDriverId(driver.id)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                    selectedDriverId === driver.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {driver.full_name || 'Unknown Driver'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {driver.phone || 'No phone'}
                        </p>
                      </div>
                    </div>
                    {selectedDriverId === driver.id && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleAssign}
              disabled={!selectedDriverId || isAssigning}
            >
              {isAssigning ? 'Assigning...' : 'Assign & Generate Tracking'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
