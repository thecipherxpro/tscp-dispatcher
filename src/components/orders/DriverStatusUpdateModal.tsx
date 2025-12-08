import { useState } from 'react';
import { MapPin, CheckCircle, AlertTriangle, Navigation, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Order, DeliveryStatus, TimelineStatus } from '@/types/auth';
import { updateOrderStatus } from '@/hooks/useOrders';
import { useToast } from '@/hooks/use-toast';
import { fetchDriverLocationData } from '@/hooks/useDriverLocation';
interface DriverStatusUpdateModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DELIVERY_STATUSES: { value: DeliveryStatus; label: string }[] = [
  { value: 'SUCCESSFULLY_DELIVERED', label: 'Successfully Delivered' },
  { value: 'PACKAGE_DELIVERED_TO_CLIENT', label: 'Package Delivered to Client' },
  { value: 'CLIENT_UNAVAILABLE', label: 'Client Unavailable' },
  { value: 'NO_ONE_HOME', label: 'No One Home / No Answer' },
  { value: 'WRONG_ADDRESS', label: 'Wrong Address' },
  { value: 'ADDRESS_INCORRECT', label: 'Address Incorrect' },
  { value: 'SAFETY_CONCERN', label: 'Safety Concern' },
  { value: 'UNSAFE_LOCATION', label: 'Unsafe Location' },
  { value: 'OTHER', label: 'Other' },
];

export function DriverStatusUpdateModal({ order, isOpen, onClose, onSuccess }: DriverStatusUpdateModalProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeliveryStatus, setShowDeliveryStatus] = useState(false);
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<DeliveryStatus | null>(null);

  if (!order) return null;

  const getNextStatus = (): TimelineStatus | null => {
    switch (order.timeline_status) {
      case 'PICKED_UP': return 'SHIPPED'; // Driver confirms and starts route -> SHIPPED
      case 'SHIPPED': return 'DELIVERED'; // Driver marks arrived and can complete
      default: return null;
    }
  };

  const nextStatus = getNextStatus();

  const handleStatusUpdate = async (newStatus: TimelineStatus, deliveryStatus?: DeliveryStatus) => {
    if ((newStatus === 'DELIVERED' || newStatus === 'DELIVERY_INCOMPLETE') && !deliveryStatus) {
      setShowDeliveryStatus(true);
      return;
    }

    setIsUpdating(true);

    // Fetch driver location data for audit logging
    const locationData = await fetchDriverLocationData();

    const result = await updateOrderStatus(
      order.id,
      order.tracking_id,
      newStatus,
      deliveryStatus,
      locationData
    );

    setIsUpdating(false);

    if (result.success) {
      toast({
        title: "Status Updated",
        description: `Order marked as ${newStatus.replace('_', ' ')}.`,
      });
      onSuccess();
    } else {
      toast({
        title: "Update Failed",
        description: result.error || "Failed to update status.",
        variant: "destructive",
      });
    }
  };

  const handleDeliveryStatusSelect = async () => {
    if (!selectedDeliveryStatus) {
      toast({
        title: "Select Outcome",
        description: "Please select a delivery outcome.",
        variant: "destructive",
      });
      return;
    }

    // Determine final timeline status based on delivery outcome
    const finalStatus: TimelineStatus = 
      selectedDeliveryStatus === 'SUCCESSFULLY_DELIVERED' || selectedDeliveryStatus === 'PACKAGE_DELIVERED_TO_CLIENT'
        ? 'DELIVERED' 
        : 'DELIVERY_INCOMPLETE';

    await handleStatusUpdate(finalStatus, selectedDeliveryStatus);
  };

  const handleAddressReview = async () => {
    setIsUpdating(true);

    // Fetch driver location data for audit logging
    const locationData = await fetchDriverLocationData();

    // Address review keeps the order at PICKED_UP but logs the event
    const result = await updateOrderStatus(
      order.id,
      order.tracking_id,
      'PICKED_UP', // Status stays at PICKED_UP
      undefined,
      locationData
    );

    setIsUpdating(false);

    if (result.success) {
      toast({
        title: "Address Review Requested",
        description: "Admin has been notified about the address issue.",
      });
      onSuccess();
    } else {
      toast({
        title: "Update Failed",
        description: result.error || "Failed to request address review.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Delivery Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Info */}
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-3">
              <p className="font-medium text-foreground">{order.name || 'Unknown Client'}</p>
              <p className="text-sm text-muted-foreground">
                {order.address_1}, {order.city}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Current: {order.timeline_status.replace('_', ' ')}
              </p>
            </CardContent>
          </Card>

          {!showDeliveryStatus ? (
            <>
              {/* Status Buttons - Driver flow: PICKED_UP -> SHIPPED -> DELIVERED/INCOMPLETE */}
              {order.timeline_status === 'PICKED_UP' && (
                <Button
                  className="w-full h-14"
                  onClick={() => handleStatusUpdate('SHIPPED')}
                  disabled={isUpdating}
                >
                  <Navigation className="w-5 h-5 mr-2" />
                  Confirm & Start Route
                </Button>
              )}

              {order.timeline_status === 'SHIPPED' && (
                <Button
                  className="w-full h-14"
                  onClick={() => handleStatusUpdate('DELIVERED')}
                  disabled={isUpdating}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Complete Delivery
                </Button>
              )}

              {/* Address Review Button - available when not delivered */}
              {order.timeline_status !== 'DELIVERED' && 
               order.timeline_status !== 'DELIVERY_INCOMPLETE' && 
               order.timeline_status !== 'PENDING' && (
                <Button
                  variant="outline"
                  className="w-full text-destructive border-destructive hover:bg-destructive/10"
                  onClick={handleAddressReview}
                  disabled={isUpdating}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Request Address Review
                </Button>
              )}
            </>
          ) : (
            <>
              {/* Delivery Status Selection */}
              <h4 className="font-medium text-foreground">Select Delivery Outcome</h4>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {DELIVERY_STATUSES.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => setSelectedDeliveryStatus(status.value)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      selectedDeliveryStatus === status.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium text-foreground">{status.label}</p>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowDeliveryStatus(false);
                    setSelectedDeliveryStatus(null);
                  }}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleDeliveryStatusSelect}
                  disabled={!selectedDeliveryStatus || isUpdating}
                >
                  {isUpdating ? 'Completing...' : 'Complete Delivery'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
