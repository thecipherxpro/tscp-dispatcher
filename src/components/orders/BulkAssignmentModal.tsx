import { useState } from 'react';
import { Truck, User, Check, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Order } from '@/types/auth';
import { useDrivers, assignDriverToOrder } from '@/hooks/useOrders';
import { useToast } from '@/hooks/use-toast';

interface BulkAssignmentModalProps {
  orders: Order[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkAssignmentModal({ orders, isOpen, onClose, onSuccess }: BulkAssignmentModalProps) {
  const { toast } = useToast();
  const { drivers, isLoading } = useDrivers();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleBulkAssign = async () => {
    if (!selectedDriverId) {
      toast({
        title: "Select a driver",
        description: "Please select a driver to assign these orders.",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);
    setProgress({ current: 0, total: orders.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      setProgress({ current: i + 1, total: orders.length });

      const result = await assignDriverToOrder(
        order.id,
        selectedDriverId,
        order.name,
        {
          doses_nasal: order.doses_nasal,
          nasal_rx: order.nasal_rx,
          doses_injectable: order.doses_injectable,
          injection_rx: order.injection_rx,
          city: order.city,
          province: order.province,
          postal: order.postal,
          country: order.country,
          pending_at: order.pending_at,
        }
      );

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsAssigning(false);
    setProgress({ current: 0, total: 0 });

    if (successCount > 0) {
      toast({
        title: "Bulk Assignment Complete",
        description: `${successCount} order${successCount > 1 ? 's' : ''} assigned successfully${failCount > 0 ? `, ${failCount} failed` : ''}.`,
      });
      onSuccess();
    } else {
      toast({
        title: "Assignment Failed",
        description: "Failed to assign orders. Please try again.",
        variant: "destructive",
      });
    }
  };

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Bulk Assign Driver
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Orders Summary */}
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {orders.length} Order{orders.length > 1 ? 's' : ''} Selected
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {orders.slice(0, 10).map((order) => (
                <Badge key={order.id} variant="secondary" className="text-xs">
                  {order.name?.split(' ')[0] || 'Unknown'}
                </Badge>
              ))}
              {orders.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{orders.length - 10} more
                </Badge>
              )}
            </div>
          </div>

          {/* Driver Selection */}
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
                          {driver.driver_id || 'No ID'} • {driver.phone || 'No phone'}
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

          {/* Progress Indicator */}
          {isAssigning && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Assigning orders...</span>
                <span className="text-sm font-medium text-foreground">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isAssigning}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleBulkAssign}
              disabled={!selectedDriverId || isAssigning}
            >
              {isAssigning 
                ? `Assigning ${progress.current}/${progress.total}...` 
                : `Assign ${orders.length} Order${orders.length > 1 ? 's' : ''}`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}