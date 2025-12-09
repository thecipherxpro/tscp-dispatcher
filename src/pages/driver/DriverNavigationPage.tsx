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
  ArrowRight, AlertCircle, CheckCircle, XCircle, Compass, Volume2, VolumeX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  endLocation: { lat: number; lng: number };
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

// Calculate distance between two points in meters
function getDistanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate bearing between two points
function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

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
  const lastRouteCalcRef = useRef<number>(0);
  const previousHeadingRef = useRef<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [driverHeading, setDriverHeading] = useState<number | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'delivered' | 'incomplete' | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFollowingDriver, setIsFollowingDriver] = useState(true);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [distanceToNextStep, setDistanceToNextStep] = useState<number | null>(null);
  const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);

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
  const getManeuverIcon = (maneuver: string, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'w-10 h-10' : 'w-5 h-5';
    if (maneuver.includes('left')) return <CornerUpLeft className={sizeClass} />;
    if (maneuver.includes('right')) return <CornerUpRight className={sizeClass} />;
    if (maneuver.includes('uturn') || maneuver.includes('u-turn')) return <RotateCcw className={sizeClass} />;
    if (maneuver.includes('straight') || maneuver.includes('head') || maneuver.includes('continue')) return <MoveUp className={sizeClass} />;
    if (maneuver.includes('destination') || maneuver.includes('arrive')) return <MapPinned className={sizeClass} />;
    return <ArrowRight className={sizeClass} />;
  };

  // Draw route
  const drawRoute = useCallback(async (origin: { lat: number; lng: number }, dest: { lat: number; lng: number }, forceRecalc = false) => {
    if (!mapRef.current) return;

    // Throttle route calculations (min 5 seconds apart unless forced)
    const now = Date.now();
    if (!forceRecalc && now - lastRouteCalcRef.current < 5000) return;
    lastRouteCalcRef.current = now;

    try {
      const directionsService = new google.maps.DirectionsService();
      
      // Always create a fresh DirectionsRenderer
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 8,
          strokeOpacity: 0.9
        }
      });

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
        maneuver: step.maneuver || 'straight',
        endLocation: {
          lat: step.end_location.lat(),
          lng: step.end_location.lng()
        }
      }));

      setRouteInfo({
        duration: leg.duration_in_traffic?.text || leg.duration?.text || '',
        distance: leg.distance?.text || '',
        durationValue: leg.duration_in_traffic?.value || leg.duration?.value || 0,
        steps
      });

      // Reset step index on new route
      setCurrentStepIndex(0);

    } catch (err) {
      console.error('Route error:', err);
    }
  }, []);

  // Update camera to follow driver with heading
  const updateCamera = useCallback((location: { lat: number; lng: number }, heading: number) => {
    if (!mapRef.current || !isFollowingDriver) return;

    mapRef.current.moveCamera({
      center: location,
      zoom: 18,
      heading: heading,
      tilt: 45
    });
  }, [isFollowingDriver]);

  // Update driver marker
  const updateDriverMarker = useCallback((location: { lat: number; lng: number }) => {
    if (!mapRef.current || !googleMapsLoaded) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.position = location;
      return;
    }

    // Create a navigation arrow marker
    const driverEl = document.createElement('div');
    driverEl.innerHTML = `
      <div style="
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 32px;
          height: 32px;
          background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L4 20l8-4 8 4L12 2z"/>
          </svg>
        </div>
      </div>
    `;

    driverMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current,
      position: location,
      content: driverEl,
      title: 'Your Location',
      zIndex: 1000
    });
  }, [googleMapsLoaded]);

  // Create destination marker
  const createDestinationMarker = useCallback((location: { lat: number; lng: number }) => {
    if (!mapRef.current || !googleMapsLoaded) return;

    const markerEl = document.createElement('div');
    markerEl.innerHTML = `
      <div style="
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 44px;
          height: 44px;
          background: linear-gradient(180deg, #ef4444 0%, #b91c1c 100%);
          border: 4px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(239, 68, 68, 0.5);
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>
    `;

    new google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current,
      position: location,
      content: markerEl,
      title: 'Destination'
    });
  }, [googleMapsLoaded]);

  // Set order to CONFIRMED and SHIPPED status
  const setConfirmedAndShippedStatus = useCallback(async (orderData: Order) => {
    if (orderData.timeline_status === 'IN_ROUTE') return;

    try {
      const locationData = await fetchDriverLocationData();
      
      // First set to CONFIRMED if not already
      if (!['CONFIRMED', 'IN_ROUTE'].includes(orderData.timeline_status || '')) {
        await updateOrderStatus(
          orderData.id,
          orderData.tracking_id || null,
          'CONFIRMED' as TimelineStatus,
          undefined,
          {
            ip_address: locationData.ip_address,
            geolocation: locationData.geolocation,
            access_location: locationData.access_location
          }
        );
      }

      // Then set to SHIPPED (IN_ROUTE)
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
      toast.success('Navigation started');
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

        // Fetch order first
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

        // Get driver location with high accuracy
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          });
        });

        if (!isMounted) return;

        const driverLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setDriverLocation(driverLoc);

        // Calculate initial heading towards destination
        const initialHeading = getBearing(
          driverLoc.lat, driverLoc.lng,
          orderData.latitude, orderData.longitude
        );
        setDriverHeading(initialHeading);
        previousHeadingRef.current = initialHeading;

        // Create map with navigation-style view
        if (!mapContainerRef.current) return;

        mapRef.current = new google.maps.Map(mapContainerRef.current, {
          center: driverLoc,
          zoom: 18,
          heading: initialHeading,
          tilt: 45,
          mapId: 'driver-navigation-map',
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });

        // Add markers
        updateDriverMarker(driverLoc);
        createDestinationMarker({ lat: orderData.latitude, lng: orderData.longitude });

        // Draw initial route
        await drawRoute(driverLoc, { lat: orderData.latitude, lng: orderData.longitude }, true);

        // Auto-set CONFIRMED and SHIPPED status
        await setConfirmedAndShippedStatus(orderData);

        // Start watching position with high frequency
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (!isMounted) return;
            
            const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const newHeading = pos.coords.heading;
            
            setDriverLocation(newLoc);
            updateDriverMarker(newLoc);

            // Use device heading if available, otherwise calculate from movement
            if (newHeading !== null && !isNaN(newHeading)) {
              setDriverHeading(newHeading);
              previousHeadingRef.current = newHeading;
              updateCamera(newLoc, newHeading);
            } else if (driverLocation) {
              // Calculate heading from movement
              const dist = getDistanceInMeters(
                driverLocation.lat, driverLocation.lng,
                newLoc.lat, newLoc.lng
              );
              if (dist > 5) { // Only update heading if moved more than 5m
                const calcHeading = getBearing(
                  driverLocation.lat, driverLocation.lng,
                  newLoc.lat, newLoc.lng
                );
                setDriverHeading(calcHeading);
                previousHeadingRef.current = calcHeading;
                updateCamera(newLoc, calcHeading);
              } else {
                updateCamera(newLoc, previousHeadingRef.current);
              }
            }
          },
          (err) => console.error('Watch position error:', err),
          { 
            enableHighAccuracy: true, 
            timeout: 5000, 
            maximumAge: 1000 
          }
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
        watchIdRef.current = null;
      }
      if (driverMarkerRef.current) {
        driverMarkerRef.current.map = null;
        driverMarkerRef.current = null;
      }
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
      mapRef.current = null;
    };
  }, [orderId, fetchOrder, fetchApiKey, drawRoute, updateDriverMarker, createDestinationMarker, setConfirmedAndShippedStatus, navigate, updateCamera]);

  // Update current step based on driver location
  useEffect(() => {
    if (!driverLocation || !routeInfo?.steps.length || !order?.latitude || !order?.longitude) return;

    // Calculate distance to destination
    const distToDest = getDistanceInMeters(
      driverLocation.lat, driverLocation.lng,
      order.latitude, order.longitude
    );
    setDistanceToDestination(distToDest);

    // Find the current step (first step where we haven't passed the end location)
    for (let i = currentStepIndex; i < routeInfo.steps.length; i++) {
      const step = routeInfo.steps[i];
      const distToStepEnd = getDistanceInMeters(
        driverLocation.lat, driverLocation.lng,
        step.endLocation.lat, step.endLocation.lng
      );

      if (i === currentStepIndex) {
        setDistanceToNextStep(distToStepEnd);
      }

      // If we're within 30m of the step end, advance to next step
      if (distToStepEnd < 30 && i === currentStepIndex && i < routeInfo.steps.length - 1) {
        setCurrentStepIndex(i + 1);
        break;
      }
    }

    // Recalculate route if we've deviated significantly (>50m from route)
    // This is a simple check - in production you'd check distance to the route line
    if (distToDest > 100) {
      drawRoute(driverLocation, { lat: order.latitude, lng: order.longitude });
    }
  }, [driverLocation, routeInfo, order, currentStepIndex, drawRoute]);

  // Format distance for display
  const formatDistance = (meters: number | null): string => {
    if (meters === null) return '';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // Recenter on driver
  const recenterOnDriver = useCallback(() => {
    setIsFollowingDriver(true);
    if (driverLocation && driverHeading !== null) {
      updateCamera(driverLocation, driverHeading);
    }
  }, [driverLocation, driverHeading, updateCamera]);

  // Handle user interaction with map
  const handleMapInteraction = useCallback(() => {
    setIsFollowingDriver(false);
  }, []);

  // Add map interaction listener
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const listeners = [
      map.addListener('dragstart', handleMapInteraction),
      map.addListener('zoom_changed', handleMapInteraction),
    ];

    return () => {
      listeners.forEach(listener => google.maps.event.removeListener(listener));
    };
  }, [googleMapsLoaded, handleMapInteraction]);

  const currentStep = routeInfo?.steps[currentStepIndex];
  const nextStep = routeInfo?.steps[currentStepIndex + 1];

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

      {/* Map container - full screen */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Current Turn Instruction - Top Card */}
      {currentStep && !isLoading && (
        <div className="absolute top-0 left-0 right-0 z-10 p-3">
          <Card className="bg-primary text-primary-foreground shadow-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                  {getManeuverIcon(currentStep.maneuver || '', 'lg')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-3xl font-bold">
                    {distanceToNextStep !== null && distanceToNextStep < 1000 
                      ? `${Math.round(distanceToNextStep)} m`
                      : distanceToNextStep !== null 
                        ? `${(distanceToNextStep / 1000).toFixed(1)} km`
                        : currentStep.distance
                    }
                  </p>
                  <p className="text-base opacity-90 truncate">{currentStep.instruction}</p>
                </div>
              </div>
              
              {/* Next turn preview */}
              {nextStep && (
                <div className="mt-3 pt-3 border-t border-primary-foreground/20 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                    {getManeuverIcon(nextStep.maneuver || '', 'sm')}
                  </div>
                  <p className="text-sm opacity-75 truncate">
                    Then: {nextStep.instruction}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Control buttons - Right side */}
      <div className="absolute top-32 right-3 z-10 flex flex-col gap-2">
        {!isFollowingDriver && (
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground"
            onClick={recenterOnDriver}
          >
            <Compass className="w-6 h-6" />
          </Button>
        )}
      </div>

      {/* Back button - Left side */}
      <div className="absolute top-32 left-3 z-10">
        <Button
          variant="secondary"
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg bg-background/95 backdrop-blur-sm"
          onClick={() => navigate('/driver-map', { replace: true })}
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>

      {/* Bottom action panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
        <Card className="bg-background shadow-2xl">
          <CardContent className="p-4">
            {/* Route info */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-lg font-bold">{routeInfo?.duration || '--'}</span>
                </div>
                <div className="h-5 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {distanceToDestination !== null 
                      ? formatDistance(distanceToDestination)
                      : routeInfo?.distance || '--'
                    }
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                In Route
              </Badge>
            </div>

            {/* Destination */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <MapPinned className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Delivering to</p>
                <p className="font-medium truncate">
                  {order?.city}, {order?.province} {order?.postal}
                </p>
              </div>
            </div>

            {/* Delivery outcome buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-14 bg-green-600 hover:bg-green-700 text-white font-semibold"
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
                className="h-14 font-semibold"
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
