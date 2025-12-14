import { useState, useCallback } from 'react';
import { FileDown, Printer, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Order } from '@/types/auth';
import { PackageLabel } from './PackageLabel';
import { usePackageLabel } from '@/hooks/usePackageLabel';

interface PackageLabelModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PackageLabelModal({ order, isOpen, onClose }: PackageLabelModalProps) {
  const { downloadLabel, printLabel } = usePackageLabel();
  const [isReady, setIsReady] = useState(false);

  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  if (!order) return null;

  const canGenerateLabel = order.tracking_id && order.shipment_id;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Package Label</DialogTitle>
          </div>
        </DialogHeader>

        {canGenerateLabel ? (
          <div className="space-y-4">
            {/* Label Preview */}
            <div className="border rounded-lg overflow-hidden bg-white flex justify-center p-4">
              <div className="transform scale-75 origin-top">
                <PackageLabel order={order} onReady={handleReady} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-12"
                onClick={() => printLabel(order)}
                disabled={!isReady}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Label
              </Button>
              <Button 
                className="flex-1 h-12"
                onClick={() => downloadLabel(order)}
                disabled={!isReady}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <FileDown className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Label Not Available
            </p>
            <p className="text-xs text-muted-foreground/70">
              Assign the order to a driver first to generate tracking ID and shipping label.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
