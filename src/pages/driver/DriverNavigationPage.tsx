import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order, TimelineStatus } from '@/types/auth';
import { updateOrderStatus } from '@/hooks/useOrders';
import { fetchDriverLocationData } from '@/hooks/useDriverLocation';
import { 
  Loader2, ArrowLeft, Navigation, Clock, MapPin, 
  CornerUpLeft, CornerUpRight, MoveUp, RotateCcw, MapPinned, 
  ArrowRight, AlertCircle, CheckCircle, XCircle, Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface DirectionStep {
  instruction: string;
  distance: string;
  duration: string;
  maneuver?: string;
}

interface RouteInfo {
  duration: string;
  distance: string;
  durationValue: number;
  steps: DirectionStep[];
}

const DELIVERY_OUTCOMES = {
  delivered: [
    { value: 'SUCCESSFULLY_DELIVERED', label: 'Successfully Delivered' },
    { value: 'PACKAGE_DELIVERED_TO_CLIENT', label: 'Package Delivered to Client' },
  ],
  incomplete: [
    { value: 'CLIENT_UNAVAILABLE', label: 'Client Unavailable' },
    { value: 'NO_ONE_HOME', label: 'No One Home' },
    { value: 'WRONG_ADDRESS', label: 'Wrong Address' },
    { value: 'ADDRESS_INCORRECT', label: 'Address Incorrect' },
    { value: 'UNSAFE_LOCATION', label: 'Unsafe Location' },
    { value: 'OTHER', label: 'Other' },
  ],
};

export default function DriverNavigationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { user } = useAuth();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const driverMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'delivered' | 'incomplete' | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  // Fetch Google Maps API key
  const fetchApiKey = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('get-google-maps-key');
    if (error) throw error;
    return data.apiKey;
  }, []);

  // Fetch order details
  const fetchOrder = useCallback(async () => {
    if (!orderId || !user) return null;
    
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('assigned_driver_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data as Order | null;
  }, [orderId, user]);

  // Get icon for maneuver type
  const getManeuverIcon = (maneuver: string) => {
    if (maneuver.includes('left')) return <CornerUpLeft className="w-5 h-5" />;
    if (maneuver.includes('right')) return <CornerUpRight className="w-5 h-5" />;
    if (maneuver.includes('uturn') || maneuver.includes('u-turn')) return <RotateCcw className="w-5 h-5" />;
    if (maneuver.includes('straight') || maneuver.includes('head') || maneuver.includes('continue')) return <MoveUp className="w-5 h-5" />;
    if (maneuver.includes('destination') || maneuver.includes('arrive')) return <MapPinned className="w-5 h-5" />;
    return <ArrowRight className="w-5 h-5" />;
  };

  // Draw route
  const drawRoute = useCallback(async (origin: { lat: number; lng: number }, dest: { lat: number; lng: number }) => {
    if (!mapRef.current) return;

    try {
      const directionsService = new google.maps.DirectionsService();
      
      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map: mapRef.current,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#f97316',
            strokeWeight: 6,
            strokeOpacity: 0.9
          }
        });
      }

      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route({
          origin: new google.maps.LatLng(origin.lat, origin.lng),
          destination: new google.maps.LatLng(dest.lat, dest.lng),
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS
          }
        }, (response, status) => {
          if (status === 'OK' && response) {
            resolve(response);
          } else {
            reject(new Error(`Directions failed: ${status}`));
          }
        });
      });

      directionsRendererRef.current.setDirections(result);

      const route = result.routes[0];
      const leg = route.legs[0];

      const steps: DirectionStep[] = leg.steps.map(step => ({
        instruction: step.instructions.replace(/<[^>]*>/g, ''),
        distance: step.distance?.text || '',
        duration: step.duration?.text || '',
        maneuver: step.maneuver || ''
      }));

      setRouteInfo({
        duration: leg.duration_in_traffic?.text || leg.duration?.text || '',
        distance: leg.distance?.text || '',
        durationValue: leg.duration_in_traffic?.value || leg.duration?.value || 0,
        steps
      });

      // Fit map to route bounds
      const bounds = route.bounds;
      if (bounds) {
        mapRef.current.fitBounds(bounds, { top: 100, bottom: 200, left: 50, right: 50 });
      }
    } catch (err) {
      console.error('Route error:', err);
      toast.error('Failed to calculate route');
    }
  }, []);

  // Update driver marker
  const updateDriverMarker = useCallback((location: { lat: number; lng: number }) => {
    if (!mapRef.current || !googleMapsLoaded) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.position = location;
      return;
    }

    const driverEl = document.createElement('div');
    driverEl.style.cssText = `
      width: 24px;
      height: 24px;
      background-color: #3b82f6;
      border: 4px solid white;
      border-radius: 50%;
      box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
    `;

    driverMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current,
      position: location,
      content: driverEl,
      title: 'Your Location'
    });
  }, [googleMapsLoaded]);

  // Create destination marker
  const createDestinationMarker = useCallback((location: { lat: number; lng: number }) => {
    if (!mapRef.current || !googleMapsLoaded) return;

    const markerEl = document.createElement('div');
    markerEl.style.cssText = `
      width: 44px;
      height: 44px;
      background-color: #000000;
      border: 4px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;
    markerEl.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    `;

    new google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current,
      position: location,
      content: markerEl,
      title: 'Destination'
    });
  }, [googleMapsLoaded]);

  // Set order to SHIPPED status
  const setShippedStatus = useCallback(async (orderData: Order) => {
    if (orderData.timeline_status === 'IN_ROUTE') return; // Already shipped

    try {
      const locationData = await fetchDriverLocationData();
      
      await updateOrderStatus(
        orderData.id,
        orderData.tracking_id || null,
        'IN_ROUTE' as TimelineStatus,
        undefined,
        {
          ip_address: locationData.ip_address,
          geolocation: locationData.geolocation,
          access_location: locationData.access_location
        }
      );

      setOrder(prev => prev ? { ...prev, timeline_status: 'IN_ROUTE' as TimelineStatus } : null);
      toast.success('Order status updated to Shipped');
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }, []);

  // Handle delivery outcome selection
  const handleDeliveryOutcome = async (deliveryStatus: string) => {
    if (!order) return;

    setIsUpdating(true);
    try {
      const locationData = await fetchDriverLocationData();
      const newStatus = outcomeType === 'delivered' ? 'COMPLETED_DELIVERED' : 'COMPLETED_INCOMPLETE';

      const result = await updateOrderStatus(
        order.id,
        order.tracking_id || null,
        newStatus as TimelineStatus,
        deliveryStatus,
        {
          ip_address: locationData.ip_address,
          geolocation: locationData.geolocation,
          access_location: locationData.access_location
        }
      );

      if (result.success) {
        toast.success(outcomeType === 'delivered' ? 'Delivery completed!' : 'Delivery marked as incomplete');
        setShowOutcomeModal(false);
        
        // Navigate back to map page for next delivery
        navigate('/driver-map', { replace: true });
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating delivery outcome:', err);
      toast.error('Failed to update delivery status');
    } finally {
      setIsUpdating(false);
    }
  };

  // Initialize navigation
  useEffect(() => {
    if (!orderId) {
      navigate('/driver-map', { replace: true });
      return;
    }

    let isMounted = true;

    const initNavigation = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch order
        const orderData = await fetchOrder();
        if (!isMounted) return;

        if (!orderData) {
          setError('Order not found');
          setIsLoading(false);
          return;
        }

        if (!orderData.latitude || !orderData.longitude) {
          setError('Order location not available');
          setIsLoading(false);
          return;
        }

        setOrder(orderData);

        // Get API key and initialize map
        const apiKey = await fetchApiKey();
        
        setOptions({
          key: apiKey,
          v: 'weekly',
        });

        await importLibrary('maps');
        await importLibrary('marker');
        if (!isMounted) return;

        setGoogleMapsLoaded(true);

        // Get driver location
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000
          });
        });

        if (!isMounted) return;

        const driverLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setDriverLocation(driverLoc);

        // Create map
        if (!mapContainerRef.current) return;

        mapRef.current = new google.maps.Map(mapContainerRef.current, {
          center: driverLoc,
          zoom: 15,
          mapId: 'driver-navigation-map',
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });

        // Add markers
        updateDriverMarker(driverLoc);
        createDestinationMarker({ lat: orderData.latitude, lng: orderData.longitude });

        // Draw route
        await drawRoute(driverLoc, { lat: orderData.latitude, lng: orderData.longitude });

        // Auto-set SHIPPED status
        await setShippedStatus(orderData);

        // Start watching position
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setDriverLocation(loc);
            updateDriverMarker(loc);
          },
          (err) => console.error('Watch position error:', err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
        );

        setIsLoading(false);
      } catch (err) {
        if (isMounted) {
          console.error('Navigation init error:', err);
          setError(err instanceof Error ? err.message : 'Failed to initialize navigation');
          setIsLoading(false);
        }
      }
    };

    initNavigation();

    return () => {
      isMounted = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (driverMarkerRef.current) {
        driverMarkerRef.current.map = null;
      }
    };
  }, [orderId, fetchOrder, fetchApiKey, drawRoute, updateDriverMarker, createDestinationMarker, setShippedStatus, navigate]);

  // Auto-recalculate route when driver moves significantly
  useEffect(() => {
    if (!driverLocation || !order?.latitude || !order?.longitude || !routeInfo) return;

    const threshold = 0.0015; // ~150m
    const prevPos = directionsRendererRef.current?.getDirections()?.routes[0]?.legs[0]?.start_location;
    
    if (prevPos) {
      const latDiff = Math.abs(prevPos.lat() - driverLocation.lat);
      const lngDiff = Math.abs(prevPos.lng() - driverLocation.lng);
      
      if (latDiff > threshold || lngDiff > threshold) {
        drawRoute(driverLocation, { lat: order.latitude, lng: order.longitude });
      }
    }
  }, [driverLocation, order, routeInfo, drawRoute]);

  // Recenter map
  const recenterOnDriver = useCallback(() => {
    if (mapRef.current && driverLocation) {
      mapRef.current.panTo(driverLocation);
      mapRef.current.setZoom(16);
    }
  }, [driverLocation]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Navigation Error</h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => navigate('/driver-map', { replace: true })}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Map
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <span className="text-muted-foreground">Starting navigation...</span>
          </div>
        </div>
      )}

      {/* Map container - takes most of screen */}
      <div ref={mapContainerRef} className="flex-1 w-full" />

      {/* Top bar - back button and route info */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 pb-0">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg bg-background/95 backdrop-blur-sm"
            onClick={() => navigate('/driver-map', { replace: true })}
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>

          {routeInfo && (
            <Card className="flex-1 bg-background/95 backdrop-blur-sm shadow-lg">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <span className="text-lg font-bold text-foreground">{routeInfo.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{routeInfo.distance}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  In Route
                </Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recenter button */}
      <div className="absolute top-20 right-4 z-10">
        <Button
          variant="secondary"
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg bg-background/95 backdrop-blur-sm"
          onClick={recenterOnDriver}
        >
          <Compass className="w-6 h-6" />
        </Button>
      </div>

      {/* Directions toggle button */}
      <div className="absolute top-20 left-4 z-10">
        <Button
          variant={showDirections ? 'default' : 'secondary'}
          size="sm"
          className="shadow-lg"
          onClick={() => setShowDirections(!showDirections)}
        >
          <MapPin className="w-4 h-4 mr-1" />
          {showDirections ? 'Hide Steps' : 'Show Steps'}
        </Button>
      </div>

      {/* Turn-by-turn directions panel */}
      {showDirections && routeInfo && (
        <div className="absolute top-36 left-4 right-4 z-10 max-h-[40vh]">
          <Card className="bg-background/95 backdrop-blur-sm shadow-lg overflow-hidden">
            <ScrollArea className="max-h-[38vh]">
              <CardContent className="p-3 space-y-2">
                {routeInfo.steps.map((step, index) => (
                  <div 
                    key={index} 
                    className={`flex items-start gap-3 p-2 rounded-lg ${
                      index === 0 ? 'bg-primary/10 border border-primary/20' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {getManeuverIcon(step.maneuver || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${index === 0 ? 'font-semibold' : ''}`}>{step.instruction}</p>
                      <span className="text-xs text-muted-foreground">{step.distance}</span>
                    </div>
                  </div>
                ))}
                
                <div className="flex items-start gap-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center">
                    <MapPinned className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">Arrive at destination</p>
                    {order && (
                      <p className="text-xs text-green-600 dark:text-green-500">
                        {order.city}, {order.postal}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </ScrollArea>
          </Card>
        </div>
      )}

      {/* Bottom action card */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pt-0">
        <Card className="bg-background shadow-2xl border-t">
          <CardContent className="p-4">
            {/* Destination info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPinned className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Delivering to</p>
                <p className="font-semibold text-foreground truncate">
                  {order?.city}, {order?.province}
                </p>
                <p className="text-xs text-muted-foreground">{order?.postal}</p>
              </div>
            </div>

            {/* Delivery outcome buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-14 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  setOutcomeType('delivered');
                  setShowOutcomeModal(true);
                }}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Delivered
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="h-14"
                onClick={() => {
                  setOutcomeType('incomplete');
                  setShowOutcomeModal(true);
                }}
              >
                <XCircle className="w-5 h-5 mr-2" />
                Incomplete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Outcome Modal */}
      <Dialog open={showOutcomeModal} onOpenChange={setShowOutcomeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {outcomeType === 'delivered' ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Confirm Delivery
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-destructive" />
                  Delivery Incomplete
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Select the specific outcome for this delivery.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-4">
            {outcomeType && DELIVERY_OUTCOMES[outcomeType].map((outcome) => (
              <Button
                key={outcome.value}
                variant="outline"
                className="w-full justify-start h-12 text-left"
                onClick={() => handleDeliveryOutcome(outcome.value)}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : outcomeType === 'delivered' ? (
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2 text-destructive" />
                )}
                {outcome.label}
              </Button>
            ))}
          </div>

          <div className="mt-4">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowOutcomeModal(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}