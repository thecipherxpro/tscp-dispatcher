import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Navigation, Package, CheckCircle, XCircle, MapPin, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { updateOrderStatus } from '@/hooks/useOrders';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from '@/hooks/use-toast';

const DELIVERED_OUTCOMES = [
  { value: 'SUCCESSFULLY_DELIVERED', label: 'Successfully Delivered' },
  { value: 'PACKAGE_DELIVERED_TO_CLIENT', label: 'Package Delivered to Client' },
];

const INCOMPLETE_OUTCOMES = [
  { value: 'CLIENT_UNAVAILABLE', label: 'Client Unavailable' },
  { value: 'NO_ONE_HOME', label: 'No One Home' },
  { value: 'WRONG_ADDRESS', label: 'Wrong Address' },
  { value: 'ADDRESS_INCORRECT', label: 'Address Incorrect' },
  { value: 'UNSAFE_LOCATION', label: 'Unsafe Location' },
  { value: 'OTHER', label: 'Other' },
];

export default function DriverDeliveryDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showOutcomeSheet, setShowOutcomeSheet] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'delivered' | 'incomplete' | null>(null);
  const [staticMapUrl, setStaticMapUrl] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const driverStartLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const { fetchLocation, locationData } = useDriverLocation();
  const haptic = useHapticFeedback();

  const orderNumber = (location.state as { orderNumber?: number })?.orderNumber || 1;

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;

    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (data) {
        setOrder(data as Order);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  const getDriverLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    fetchOrder();
    getDriverLocation();
    fetchLocation();
  }, [fetchOrder, getDriverLocation, fetchLocation]);

  // Generate static map URL
  useEffect(() => {
    if (!order?.latitude || !order?.longitude || !driverLocation) return;

    const generateStaticMap = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-google-maps-key');
        if (!data?.key) return;

        const origin = `${driverLocation.lat},${driverLocation.lng}`;
        const destination = `${order.latitude},${order.longitude}`;
        
        // Simple static map with markers
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
          `size=640x300&scale=2` +
          `&maptype=roadmap` +
          `&style=feature:poi|visibility:off` +
          `&style=feature:transit|visibility:off` +
          `&markers=color:blue|${origin}` +
          `&markers=icon:https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png|${destination}` +
          `&path=color:0xF97316|weight:4|${origin}|${destination}` +
          `&key=${data.key}`;

        setStaticMapUrl(mapUrl);
      } catch (error) {
        console.error('Error generating static map:', error);
      }
    };

    generateStaticMap();
  }, [order, driverLocation]);

  const handleStartNavigation = async () => {
    if (!order || !driverLocation) return;

    haptic.medium();
    setIsUpdating(true);

    try {
      // Store driver start location for snapshot later
      driverStartLocationRef.current = { ...driverLocation };

      // Update status to CONFIRMED then IN_ROUTE (SHIPPED)
      if (order.timeline_status === 'PICKED_UP_AND_ASSIGNED') {
        await updateOrderStatus(order.id, order.tracking_id || null, 'CONFIRMED', undefined, locationData || undefined);
      }
      
      await updateOrderStatus(order.id, order.tracking_id || null, 'IN_ROUTE', undefined, locationData || undefined);

      // Open external Google Maps
      const destination = `${order.latitude},${order.longitude}`;
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${driverLocation.lat},${driverLocation.lng}&destination=${destination}&travelmode=driving`;
      
      window.open(mapsUrl, '_blank');

      // Refresh order data
      await fetchOrder();

      toast({
        title: 'Navigation Started',
        description: 'Google Maps opened. Return here to mark delivery outcome.',
      });
    } catch (error) {
      console.error('Error starting navigation:', error);
      toast({
        title: 'Error',
        description: 'Failed to start navigation',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDropOff = () => {
    haptic.light();
    setShowOutcomeSheet(true);
    setOutcomeType(null);
  };

  const handleOutcomeSelect = async (outcome: string, isDelivered: boolean) => {
    if (!order) return;

    haptic.medium();
    setIsUpdating(true);

    try {
      const newStatus = isDelivered ? 'COMPLETED_DELIVERED' : 'COMPLETED_INCOMPLETE';
      
      await updateOrderStatus(
        order.id,
        order.tracking_id || null,
        newStatus as any, 
        outcome,
        locationData || undefined
      );

      // Generate route snapshot
      if (driverStartLocationRef.current && order.latitude && order.longitude) {
        try {
          await supabase.functions.invoke('generate-route-snapshot', {
            body: {
              orderId: order.id,
              startLat: driverStartLocationRef.current.lat,
              startLng: driverStartLocationRef.current.lng,
              endLat: order.latitude,
              endLng: order.longitude,
            }
          });
        } catch (snapshotError) {
          console.error('Snapshot generation error:', snapshotError);
        }
      }

      toast({
        title: isDelivered ? 'Delivery Complete' : 'Delivery Incomplete',
        description: 'Order status updated successfully.',
      });

      setShowOutcomeSheet(false);
      
      // Navigate back to zone list
      navigate(-1);
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: 'Error',
        description: 'Failed to update order status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getPublicTimelineStatus = (status: string | null) => {
    switch (status) {
      case 'PENDING':
        return { label: 'PENDING', variant: 'secondary' as const };
      case 'PICKED_UP_AND_ASSIGNED':
        return { label: 'PICKED UP', variant: 'default' as const };
      case 'CONFIRMED':
      case 'IN_ROUTE':
        return { label: 'SHIPPED', variant: 'default' as const };
      case 'COMPLETED_DELIVERED':
        return { label: 'DELIVERED', variant: 'default' as const };
      case 'COMPLETED_INCOMPLETE':
        return { label: 'INCOMPLETE', variant: 'destructive' as const };
      default:
        return { label: 'PENDING', variant: 'secondary' as const };
    }
  };

  const canStartNavigation = order?.timeline_status === 'PICKED_UP_AND_ASSIGNED' || 
                             order?.timeline_status === 'CONFIRMED';
  const canDropOff = order?.timeline_status === 'IN_ROUTE';
  const isCompleted = order?.timeline_status === 'COMPLETED_DELIVERED' || 
                      order?.timeline_status === 'COMPLETED_INCOMPLETE';

  if (isLoading) {
    return (
      <AppLayout title="Delivery Details" showBackButton>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout title="Delivery Details" showBackButton>
        <div className="p-4 text-center">
          <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Order not found</p>
        </div>
      </AppLayout>
    );
  }

  const status = getPublicTimelineStatus(order.timeline_status);

  // Timeline steps
  const timelineSteps = [
    { label: 'Pending', active: true },
    { label: 'Picked Up', active: ['PICKED_UP_AND_ASSIGNED', 'CONFIRMED', 'IN_ROUTE', 'COMPLETED_DELIVERED', 'COMPLETED_INCOMPLETE'].includes(order.timeline_status || '') },
    { label: 'Shipped', active: ['IN_ROUTE', 'COMPLETED_DELIVERED', 'COMPLETED_INCOMPLETE'].includes(order.timeline_status || '') },
    { label: isCompleted ? (order.timeline_status === 'COMPLETED_DELIVERED' ? 'Delivered' : 'Incomplete') : 'Delivered', active: isCompleted },
  ];

  return (
    <AppLayout title="Delivery Details" showBackButton>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Static Route Preview */}
        <div className="relative h-48 bg-muted">
          {staticMapUrl ? (
            <img 
              src={staticMapUrl} 
              alt="Route preview" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {/* Order Number Overlay */}
          <div className="absolute top-4 left-4 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold shadow-lg">
            {orderNumber}
          </div>
        </div>

        {/* Delivery Info */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-4">
              {/* Shipment ID & Status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Shipment ID</p>
                  <p className="font-semibold text-foreground">{order.shipment_id || 'Not assigned'}</p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>

              {/* Location */}
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">
                    {order.city}, {order.province}
                  </p>
                  <p className="text-sm text-muted-foreground">{order.postal}</p>
                </div>
              </div>

              {/* Timeline Progress */}
              <div className="pt-2">
                <div className="flex items-center justify-between">
                  {timelineSteps.map((step, index) => (
                    <div key={step.label} className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        step.active ? 'bg-primary' : 'bg-muted'
                      }`} />
                      {index < timelineSteps.length - 1 && (
                        <div className={`w-12 h-0.5 ${
                          timelineSteps[index + 1].active ? 'bg-primary' : 'bg-muted'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  {timelineSteps.map((step) => (
                    <span key={step.label} className="text-[10px] text-muted-foreground">
                      {step.label}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        {!isCompleted && (
          <div className="p-4 space-y-3 border-t border-border bg-card safe-area-bottom">
            <Button
              className="w-full"
              size="lg"
              onClick={handleStartNavigation}
              disabled={!canStartNavigation || isUpdating || !driverLocation}
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4 mr-2" />
              )}
              Start Navigation
            </Button>
            
            <Button
              className="w-full"
              size="lg"
              variant="secondary"
              onClick={handleDropOff}
              disabled={!canDropOff || isUpdating}
            >
              <Package className="w-4 h-4 mr-2" />
              Drop-Off
            </Button>
          </div>
        )}
      </div>

      {/* Delivery Outcome Bottom Sheet */}
      <Sheet open={showOutcomeSheet} onOpenChange={setShowOutcomeSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle>Mark Delivery Outcome</SheetTitle>
          </SheetHeader>

          {!outcomeType ? (
            <div className="space-y-3 pb-6">
              <Button
                className="w-full h-14"
                variant="default"
                onClick={() => setOutcomeType('delivered')}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Delivered
              </Button>
              <Button
                className="w-full h-14"
                variant="destructive"
                onClick={() => setOutcomeType('incomplete')}
              >
                <XCircle className="w-5 h-5 mr-2" />
                Delivery Incomplete
              </Button>
            </div>
          ) : outcomeType === 'delivered' ? (
            <div className="space-y-2 pb-6">
              {DELIVERED_OUTCOMES.map((outcome) => (
                <Button
                  key={outcome.value}
                  className="w-full justify-start h-12"
                  variant="outline"
                  onClick={() => handleOutcomeSelect(outcome.value, true)}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                  )}
                  {outcome.label}
                </Button>
              ))}
              <Button
                className="w-full mt-2"
                variant="ghost"
                onClick={() => setOutcomeType(null)}
              >
                Back
              </Button>
            </div>
          ) : (
            <div className="space-y-2 pb-6">
              {INCOMPLETE_OUTCOMES.map((outcome) => (
                <Button
                  key={outcome.value}
                  className="w-full justify-start h-12"
                  variant="outline"
                  onClick={() => handleOutcomeSelect(outcome.value, false)}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2 text-destructive" />
                  )}
                  {outcome.label}
                </Button>
              ))}
              <Button
                className="w-full mt-2"
                variant="ghost"
                onClick={() => setOutcomeType(null)}
              >
                Back
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
