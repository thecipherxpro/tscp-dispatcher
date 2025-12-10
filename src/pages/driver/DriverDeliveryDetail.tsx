import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Navigation, Package, CheckCircle, XCircle, MapPin, Loader2, Clock, Route } from 'lucide-react';
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
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; arrivalTime: string } | null>(null);
  const [googleMapsKey, setGoogleMapsKey] = useState<string | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
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

  // Fetch Google Maps API key
  useEffect(() => {
    const getApiKey = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-google-maps-key');
        if (data?.key) {
          setGoogleMapsKey(data.key);
        }
      } catch (error) {
        console.error('Error fetching Google Maps key:', error);
      }
    };
    getApiKey();
  }, []);

  useEffect(() => {
    fetchOrder();
    getDriverLocation();
    fetchLocation();
  }, [fetchOrder, getDriverLocation, fetchLocation]);

  // Geocode address if no coordinates
  useEffect(() => {
    if (!order || !googleMapsKey) return;

    if (order.latitude && order.longitude) {
      setDestinationCoords({ lat: order.latitude, lng: order.longitude });
    } else if (order.address_1) {
      const geocodeAddress = async () => {
        try {
          const address = `${order.address_1}, ${order.city || ''}, ${order.province || ''} ${order.postal || ''}, Canada`;
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsKey}`
          );
          const data = await response.json();
          if (data.results?.[0]?.geometry?.location) {
            setDestinationCoords(data.results[0].geometry.location);
          }
        } catch (error) {
          console.error('Geocoding error:', error);
        }
      };
      geocodeAddress();
    }
  }, [order, googleMapsKey]);

  // Initialize Google Map with route
  useEffect(() => {
    if (!driverLocation || !destinationCoords || !googleMapsKey || !mapRef.current) return;

    const initMap = async () => {
      // Load Google Maps script if not already loaded
      if (!window.google) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places`;
        script.async = true;
        script.onload = () => createMap();
        document.head.appendChild(script);
      } else {
        createMap();
      }
    };

    const createMap = () => {
      if (!mapRef.current) return;

      // Create map
      const map = new google.maps.Map(mapRef.current, {
        center: driverLocation,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          { featureType: 'all', elementType: 'geometry', stylers: [{ saturation: -30 }] },
        ],
      });

      mapInstanceRef.current = map;

      // Create directions renderer
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#F97316',
          strokeWeight: 5,
        },
      });
      directionsRendererRef.current = directionsRenderer;

      // Get directions
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: driverLocation,
          destination: destinationCoords,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRenderer.setDirections(result);

            // Add custom markers
            // Driver marker (blue dot)
            new google.maps.Marker({
              position: driverLocation,
              map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#3B82F6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              },
            });

            // Destination marker (white house icon in black circle)
            new google.maps.Marker({
              position: destinationCoords,
              map,
              icon: {
                url: 'data:image/svg+xml,' + encodeURIComponent(`
                  <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="18" fill="#1f2937" stroke="#ffffff" stroke-width="2"/>
                    <path d="M20 12L12 18V28H17V23H23V28H28V18L20 12Z" fill="#ffffff"/>
                  </svg>
                `),
                scaledSize: new google.maps.Size(40, 40),
                anchor: new google.maps.Point(20, 20),
              },
            });

            // Extract route info
            const leg = result.routes[0].legs[0];
            const now = new Date();
            const durationMs = leg.duration?.value ? leg.duration.value * 1000 : 0;
            const arrivalDate = new Date(now.getTime() + durationMs);
            const arrivalTime = arrivalDate.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });

            setRouteInfo({
              distance: leg.distance?.text || '—',
              duration: leg.duration?.text || '—',
              arrivalTime,
            });

            // Fit bounds to show entire route
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(driverLocation);
            bounds.extend(destinationCoords);
            map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
          }
        }
      );
    };

    initMap();
  }, [driverLocation, destinationCoords, googleMapsKey]);

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
      let destination: string;
      if (destinationCoords) {
        destination = `${destinationCoords.lat},${destinationCoords.lng}`;
      } else {
        destination = encodeURIComponent(`${order.address_1 || ''}, ${order.city || ''}, ${order.province || ''} ${order.postal || ''}`);
      }
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
      if (driverStartLocationRef.current && destinationCoords) {
        try {
          await supabase.functions.invoke('generate-route-snapshot', {
            body: {
              orderId: order.id,
              startLat: driverStartLocationRef.current.lat,
              startLng: driverStartLocationRef.current.lng,
              endLat: destinationCoords.lat,
              endLng: destinationCoords.lng,
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
        return { label: 'Pending', variant: 'secondary' as const };
      case 'PICKED_UP_AND_ASSIGNED':
        return { label: 'Picked Up', variant: 'default' as const };
      case 'CONFIRMED':
        return { label: 'Confirmed', variant: 'default' as const };
      case 'IN_ROUTE':
        return { label: 'In Transit', variant: 'default' as const };
      case 'COMPLETED_DELIVERED':
        return { label: 'Delivered', variant: 'default' as const };
      case 'COMPLETED_INCOMPLETE':
        return { label: 'Incomplete', variant: 'destructive' as const };
      default:
        return { label: 'Pending', variant: 'secondary' as const };
    }
  };

  const canStartNavigation = order?.timeline_status === 'PICKED_UP_AND_ASSIGNED' || 
                             order?.timeline_status === 'CONFIRMED';
  const canDropOff = order?.timeline_status === 'IN_ROUTE';
  const isCompleted = order?.timeline_status === 'COMPLETED_DELIVERED' || 
                      order?.timeline_status === 'COMPLETED_INCOMPLETE';

  // Timeline steps
  const getTimelineProgress = () => {
    const steps = ['PENDING', 'PICKED_UP_AND_ASSIGNED', 'IN_ROUTE', 'COMPLETED'];
    const currentStatus = order?.timeline_status || 'PENDING';
    
    if (currentStatus === 'COMPLETED_DELIVERED' || currentStatus === 'COMPLETED_INCOMPLETE') {
      return 100;
    }
    if (currentStatus === 'IN_ROUTE' || currentStatus === 'CONFIRMED') {
      return 66;
    }
    if (currentStatus === 'PICKED_UP_AND_ASSIGNED') {
      return 33;
    }
    return 0;
  };

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

  return (
    <AppLayout title="Delivery Details" showBackButton>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Google Map with Route */}
        <div className="relative h-56 bg-muted">
          <div ref={mapRef} className="w-full h-full" />
          
          {/* Loading overlay */}
          {(!driverLocation || !destinationCoords) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Order Number Overlay */}
          <div className="absolute top-3 left-3 w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center text-lg font-bold shadow-lg">
            {orderNumber}
          </div>
        </div>

        {/* Route Stats Card */}
        <Card className="mx-4 -mt-6 relative z-10 shadow-lg border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-foreground">{routeInfo?.distance || '—'}</p>
                <p className="text-xs text-muted-foreground">Distance</p>
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{routeInfo?.duration || '—'}</p>
                <p className="text-xs text-muted-foreground">Time Left</p>
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{routeInfo?.arrivalTime || '—'}</p>
                <p className="text-xs text-muted-foreground">Arrival</p>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="mt-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-foreground" />
              <div className="flex-1 relative h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${getTimelineProgress()}%` }}
                />
                {/* Arrow indicator */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 transition-all duration-500"
                  style={{ left: `${Math.min(getTimelineProgress(), 95)}%` }}
                >
                  <div className="w-0 h-0 border-l-[8px] border-l-primary border-y-[5px] border-y-transparent" />
                </div>
              </div>
              <MapPin className="w-5 h-5 text-destructive" />
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Shipment Info Card */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-bold text-primary text-lg">#{order.shipment_id || order.tracking_id || '—'}</p>
                    <p className="text-sm text-muted-foreground">Shipment ID</p>
                  </div>
                </div>
                <Badge variant={status.variant} className="text-xs px-3 py-1">
                  {status.label}
                </Badge>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                {/* Customer */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Customer</p>
                  <p className="font-semibold text-foreground">{order.name || 'Unknown Client'}</p>
                </div>

                {/* Delivery Address */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Delivery Address</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-foreground">
                      {order.address_1}{order.address_2 ? `, ${order.address_2}` : ''}, {order.city}, {order.province} {order.postal}
                    </p>
                  </div>
                </div>

                {/* Tracking ID */}
                {order.tracking_id && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tracking ID</p>
                    <p className="text-sm font-medium text-foreground">{order.tracking_id}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-3">Delivery Timeline</p>
              <div className="flex items-center justify-between">
                {/* Start point */}
                <div className="text-center">
                  <div className="w-3 h-3 rounded-full bg-foreground mx-auto" />
                  <p className="text-[10px] text-muted-foreground mt-1">Pickup</p>
                </div>
                
                {/* Progress line */}
                <div className="flex-1 mx-2 relative">
                  <div className="h-0.5 bg-muted rounded-full" />
                  <div 
                    className="absolute top-0 left-0 h-0.5 bg-foreground rounded-full transition-all duration-500"
                    style={{ width: `${getTimelineProgress()}%` }}
                  />
                </div>

                {/* End point */}
                <div className="text-center">
                  <div className={`w-3 h-3 rounded-full mx-auto ${isCompleted ? 'bg-foreground' : 'bg-muted'}`} />
                  <p className="text-[10px] text-muted-foreground mt-1">Delivery</p>
                </div>
              </div>

              {/* Locations */}
              <div className="flex justify-between mt-3 text-xs">
                <div>
                  <p className="text-muted-foreground">From</p>
                  <p className="font-medium text-foreground">Pharmacy</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">To</p>
                  <p className="font-medium text-foreground">{order.city}, {order.province}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        {!isCompleted && (
          <div className="p-4 space-y-3 border-t border-border bg-card safe-area-bottom">
            <Button
              className="w-full h-12"
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
              className="w-full h-12"
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
