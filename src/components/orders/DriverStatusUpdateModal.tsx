import { useState } from 'react';
import { CheckCircle, AlertTriangle, Navigation, Clock, FileText } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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

// Delivery statuses for successful delivery
const DELIVERED_STATUSES: { value: DeliveryStatus; label: string }[] = [
  { value: 'SUCCESSFULLY_DELIVERED', label: 'Successfully Delivered' },
  { value: 'PACKAGE_DELIVERED_TO_CLIENT', label: 'Package Delivered to Client' },
];

// Delivery statuses for delayed/incomplete delivery
const DELAYED_STATUSES: { value: DeliveryStatus; label: string }[] = [
  { value: 'CLIENT_UNAVAILABLE', label: 'Client Unavailable' },
  { value: 'NO_ONE_HOME', label: 'No One Home / No Answer' },
  { value: 'WRONG_ADDRESS', label: 'Wrong Address' },
  { value: 'ADDRESS_INCORRECT', label: 'Address Incorrect' },
  { value: 'UNSAFE_LOCATION', label: 'Unsafe Location' },
  { value: 'OTHER', label: 'Other' },
];

// Review request reasons
const REVIEW_REASONS = [
  { value: 'ADDRESS_INCOMPLETE', label: 'Address Incomplete' },
  { value: 'OTHER', label: 'Other' },
];

export function DriverStatusUpdateModal({ order, isOpen, onClose, onSuccess }: DriverStatusUpdateModalProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeliveryOutcome, setShowDeliveryOutcome] = useState(false);
  const [showDeliveryStatus, setShowDeliveryStatus] = useState(false);
  const [showDelayedStatus, setShowDelayedStatus] = useState(false);
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<DeliveryStatus | null>(null);
  const [selectedReviewReason, setSelectedReviewReason] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  if (!order) return null;

  const resetState = () => {
    setShowDeliveryOutcome(false);
    setShowDeliveryStatus(false);
    setShowDelayedStatus(false);
    setShowReviewRequest(false);
    setSelectedDeliveryStatus(null);
    setSelectedReviewReason(null);
    setReviewNotes('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleStatusUpdate = async (newStatus: TimelineStatus, deliveryStatus?: DeliveryStatus, reviewData?: { review_reason?: string; review_notes?: string }) => {
    setIsUpdating(true);

    // Update status immediately without waiting for location data
    const result = await updateOrderStatus(
      order.id,
      order.tracking_id,
      newStatus,
      deliveryStatus,
      undefined, // Location data will be fetched in background
      reviewData
    );

    // Fetch location in background and update audit log (non-blocking)
    fetchDriverLocationData().then(async (locationData) => {
      if (locationData.ip_address || locationData.geolocation) {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Get the latest audit log for this order and update it
        const { data: latestLog } = await supabase
          .from('order_audit_logs')
          .select('id')
          .eq('order_id', order.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (latestLog) {
          await supabase.from('order_audit_logs')
            .update({
              ip_address: locationData.ip_address,
              geolocation: locationData.geolocation,
              access_location: locationData.access_location,
            })
            .eq('id', latestLog.id);
        }
      }
    }).catch(console.error);

    setIsUpdating(false);

    if (result.success) {
      const statusLabel = newStatus === 'REVIEW_REQUESTED' ? 'Review Requested' : newStatus.replace(/_/g, ' ');
      toast({
        title: "Status Updated",
        description: `Order marked as ${statusLabel}.`,
      });
      resetState();
      onSuccess();
    } else {
      toast({
        title: "Update Failed",
        description: result.error || "Failed to update status.",
        variant: "destructive",
      });
    }
  };

  // Handle confirm order (PICKED_UP_AND_ASSIGNED -> CONFIRMED)
  const handleConfirmOrder = () => {
    handleStatusUpdate('CONFIRMED');
  };

  // Handle request for review
  const handleRequestReview = async () => {
    if (!selectedReviewReason) {
      toast({
        title: "Select Reason",
        description: "Please select a reason for review.",
        variant: "destructive",
      });
      return;
    }

    if (selectedReviewReason === 'OTHER' && !reviewNotes.trim()) {
      toast({
        title: "Provide Details",
        description: "Please provide details for the review request.",
        variant: "destructive",
      });
      return;
    }

    await handleStatusUpdate('REVIEW_REQUESTED', undefined, {
      review_reason: selectedReviewReason,
      review_notes: reviewNotes.trim() || undefined
    });
  };

  // Handle shipped (CONFIRMED -> IN_ROUTE)
  const handleShipped = () => {
    handleStatusUpdate('IN_ROUTE');
  };


  // Handle delivery completion
  const handleDeliveryComplete = async () => {
    if (!selectedDeliveryStatus) {
      toast({
        title: "Select Outcome",
        description: "Please select a delivery outcome.",
        variant: "destructive",
      });
      return;
    }

    // Determine final timeline status based on delivery outcome
    const isSuccessfulDelivery = selectedDeliveryStatus === 'SUCCESSFULLY_DELIVERED' || 
                                  selectedDeliveryStatus === 'PACKAGE_DELIVERED_TO_CLIENT';
    
    const finalStatus: TimelineStatus = isSuccessfulDelivery 
      ? 'COMPLETED_DELIVERED' 
      : 'COMPLETED_INCOMPLETE';

    await handleStatusUpdate(finalStatus, selectedDeliveryStatus);
  };

  // Render content based on current status and selected view
  const renderContent = () => {
    // Delivery Outcome Choice View (Delivered vs Delayed)
    if (showDeliveryOutcome && !showDeliveryStatus && !showDelayedStatus) {
      return (
        <>
          <h4 className="font-medium text-foreground text-lg">Mark Delivery Outcome</h4>
          <p className="text-sm text-muted-foreground mb-4">Select the delivery outcome</p>
          
          <div className="space-y-3">
            <Button
              className="w-full h-16 bg-green-600 hover:bg-green-700 text-lg"
              onClick={() => setShowDeliveryStatus(true)}
              disabled={isUpdating}
            >
              <CheckCircle className="w-6 h-6 mr-3" />
              Delivered
            </Button>
            <Button
              variant="outline"
              className="w-full h-16 text-amber-600 border-amber-500 hover:bg-amber-50 text-lg"
              onClick={() => setShowDelayedStatus(true)}
              disabled={isUpdating}
            >
              <Clock className="w-6 h-6 mr-3" />
              Delivery Delayed
            </Button>
          </div>
        </>
      );
    }

    // Review Request View
    if (showReviewRequest) {
      return (
        <>
          <h4 className="font-medium text-foreground">Request For Review</h4>
          <p className="text-sm text-muted-foreground mb-4">Select a reason for review</p>
          
          <div className="space-y-2 mb-4">
            {REVIEW_REASONS.map((reason) => (
              <button
                key={reason.value}
                onClick={() => setSelectedReviewReason(reason.value)}
                className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                  selectedReviewReason === reason.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-medium text-foreground">{reason.label}</p>
              </button>
            ))}
          </div>

          {selectedReviewReason === 'OTHER' && (
            <Textarea
              placeholder="Please provide details..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="mb-4"
            />
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowReviewRequest(false);
                setSelectedReviewReason(null);
                setReviewNotes('');
              }}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={handleRequestReview}
              disabled={!selectedReviewReason || isUpdating}
            >
              {isUpdating ? 'Submitting...' : 'Submit Review Request'}
            </Button>
          </div>
        </>
      );
    }

    // Delivered Status Selection
    if (showDeliveryStatus) {
      return (
        <>
          <h4 className="font-medium text-foreground">Mark as Delivered</h4>
          <p className="text-sm text-muted-foreground mb-4">Select delivery outcome</p>
          
          <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
            {DELIVERED_STATUSES.map((status) => (
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
              onClick={handleDeliveryComplete}
              disabled={!selectedDeliveryStatus || isUpdating}
            >
              {isUpdating ? 'Completing...' : 'Complete Delivery'}
            </Button>
          </div>
        </>
      );
    }

    // Delayed Status Selection
    if (showDelayedStatus) {
      return (
        <>
          <h4 className="font-medium text-foreground">Delivery Delayed</h4>
          <p className="text-sm text-muted-foreground mb-4">Select reason for delay</p>
          
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {DELAYED_STATUSES.map((status) => (
              <button
                key={status.value}
                onClick={() => setSelectedDeliveryStatus(status.value)}
                className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                  selectedDeliveryStatus === status.value
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-border hover:border-amber-500/50'
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
                setShowDelayedStatus(false);
                setSelectedDeliveryStatus(null);
              }}
            >
              Back
            </Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700"
              onClick={handleDeliveryComplete}
              disabled={!selectedDeliveryStatus || isUpdating}
            >
              {isUpdating ? 'Submitting...' : 'Confirm Delay'}
            </Button>
          </div>
        </>
      );
    }

    // Main action buttons based on current status
    return (
      <>
        {/* PICKED_UP_AND_ASSIGNED - Show Confirm Order or Request Review */}
        {order.timeline_status === 'PICKED_UP_AND_ASSIGNED' && (
          <div className="space-y-3">
            <Button
              className="w-full h-14"
              onClick={handleConfirmOrder}
              disabled={isUpdating}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Confirm Order
            </Button>
            <Button
              variant="outline"
              className="w-full text-amber-600 border-amber-500 hover:bg-amber-50"
              onClick={() => setShowReviewRequest(true)}
              disabled={isUpdating}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Request For Review
            </Button>
          </div>
        )}

        {/* CONFIRMED - Show Start Route (Shipped) */}
        {order.timeline_status === 'CONFIRMED' && (
          <Button
            className="w-full h-14"
            onClick={handleShipped}
            disabled={isUpdating}
          >
            <Navigation className="w-5 h-5 mr-2" />
            Start Route (Shipped)
          </Button>
        )}

        {/* IN_ROUTE - Show Mark Delivery Outcome */}
        {order.timeline_status === 'IN_ROUTE' && (
          <Button
            className="w-full h-14"
            onClick={() => setShowDeliveryOutcome(true)}
            disabled={isUpdating}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Mark Delivery Outcome
          </Button>
        )}

        {/* REVIEW_REQUESTED - Show waiting message */}
        {order.timeline_status === 'REVIEW_REQUESTED' && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 text-center">
              <FileText className="w-8 h-8 mx-auto mb-2 text-amber-600" />
              <p className="font-medium text-amber-900">Review Requested</p>
              <p className="text-sm text-amber-700 mt-1">
                Waiting for admin to review this order.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Completed statuses */}
        {(order.timeline_status === 'COMPLETED_DELIVERED' || order.timeline_status === 'COMPLETED_INCOMPLETE') && (
          <Card className={order.timeline_status === 'COMPLETED_DELIVERED' ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
            <CardContent className="p-4 text-center">
              {order.timeline_status === 'COMPLETED_DELIVERED' ? (
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
              ) : (
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-600" />
              )}
              <p className={`font-medium ${order.timeline_status === 'COMPLETED_DELIVERED' ? 'text-green-900' : 'text-red-900'}`}>
                {order.timeline_status === 'COMPLETED_DELIVERED' ? 'Delivery Completed' : 'Delivery Incomplete'}
              </p>
              {order.delivery_status && (
                <p className={`text-sm mt-1 ${order.timeline_status === 'COMPLETED_DELIVERED' ? 'text-green-700' : 'text-red-700'}`}>
                  {order.delivery_status.replace(/_/g, ' ')}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </>
    );
  };

  return (
    <Drawer open={isOpen} onOpenChange={handleClose}>
      <DrawerContent className="px-4 pb-8">
        <DrawerHeader className="text-left px-0">
          <DrawerTitle>Update Delivery Status</DrawerTitle>
        </DrawerHeader>

        <div className="space-y-4">
          {/* Order Info */}
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-3">
              <p className="font-medium text-foreground">{order.name || 'Unknown Client'}</p>
              <p className="text-sm text-muted-foreground">
                {order.address_1}, {order.city}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Current: {order.timeline_status.replace(/_/g, ' ')}
              </p>
            </CardContent>
          </Card>

          {renderContent()}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
