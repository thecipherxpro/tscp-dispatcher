import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Navigation, Package, CheckCircle, XCircle, MapPin, Loader2, Clock, ChevronUp, ChevronDown, Phone } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SwipeButton } from '@/components/driver/SwipeButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/auth';
import { updateOrderStatus } from '@/hooks/useOrders';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
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
      if (data) setOrder(data as Order);
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
        (error) => console.error('Geolocation error:', error)
      );
    }
  }, []);

  // Fetch Mapbox token
  useEffect(() => {
    const getToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (!error && data?.token) setMapboxToken(data.token);
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
      }
    };
    getToken();
  }, []);

  useEffect(() => {
    fetchOrder();
    getDriverLocation();
    fetchLocation();
  }, [fetchOrder, getDriverLocation, fetchLocation]);

  // Geocode address if no coordinates
  useEffect(() => {
    if (!order || !mapboxToken) return;
    if (order.latitude && order.longitude) {
      setDestinationCoords({ lat: order.latitude, lng: order.longitude });
    } else if (order.address_1) {
      const geocodeAddress = async () => {
        try {
          const address = `${order.address_1}, ${order.city || ''}, ${order.province || ''} ${order.postal || ''}, Canada`;
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}`
          );
          const data = await response.json();
          if (data.features?.[0]?.center) {
            setDestinationCoords({ lat: data.features[0].center[1], lng: data.features[0].center[0] });
          }
        } catch (error) {
          console.error('Geocoding error:', error);
        }
      };
      geocodeAddress();
    }
  }, [order, mapboxToken]);

  // Initialize Mapbox Map
  useEffect(() => {
    if (!driverLocation || !destinationCoords || !mapboxToken || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [driverLocation.lng, driverLocation.lat],
      zoom: 13,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', async () => {
      setMapLoaded(true);

      // Driver marker
      const driverEl = document.createElement('div');
      driverEl.innerHTML = `<div style="width: 20px; height: 20px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`;
      new mapboxgl.Marker({ element: driverEl }).setLngLat([driverLocation.lng, driverLocation.lat]).addTo(map);

      // Destination marker
      const destEl = document.createElement('div');
      destEl.innerHTML = `<svg width="32" height="32" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#1f2937" stroke="#fff" stroke-width="2"/><path d="M20 12L12 18V28H17V23H23V28H28V18L20 12Z" fill="#fff"/></svg>`;
      new mapboxgl.Marker({ element: destEl }).setLngLat([destinationCoords.lng, destinationCoords.lat]).addTo(map);

      // Fetch route
      try {
        const routeResponse = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLocation.lng},${driverLocation.lat};${destinationCoords.lng},${destinationCoords.lat}?geometries=geojson&overview=full&access_token=${mapboxToken}`
        );
        const routeData = await routeResponse.json();

        if (routeData.routes?.[0]) {
          const route = routeData.routes[0];
          map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: route.geometry } });
          map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#F97316', 'line-width': 4 } });

          const distanceKm = (route.distance / 1000).toFixed(1);
          const durationMin = Math.round(route.duration / 60);
          const arrivalDate = new Date(Date.now() + route.duration * 1000);
          setRouteInfo({
            distance: `${distanceKm} km`,
            duration: `${durationMin} min`,
            arrivalTime: arrivalDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          });

          const coordinates = route.geometry.coordinates;
          const bounds = coordinates.reduce((b: mapboxgl.LngLatBounds, c: number[]) => b.extend(c as [number, number]), new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
          map.fitBounds(bounds, { padding: 40 });
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [driverLocation, destinationCoords, mapboxToken]);

  const handleStartNavigation = async () => {
    if (!order || !driverLocation) return;
    haptic.medium();
    setIsUpdating(true);

    try {
      driverStartLocationRef.current = { ...driverLocation };

      if (order.timeline_status === 'PICKED_UP_AND_ASSIGNED') {
        await updateOrderStatus(order.id, order.tracking_id || null, 'CONFIRMED', undefined, locationData || undefined);
      }
      await updateOrderStatus(order.id, order.tracking_id || null, 'IN_ROUTE', undefined, locationData || undefined);

      let destination: string;
      if (destinationCoords) {
        destination = `${destinationCoords.lat},${destinationCoords.lng}`;
      } else {
        destination = encodeURIComponent(`${order.address_1 || ''}, ${order.city || ''}, ${order.province || ''} ${order.postal || ''}`);
      }
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${driverLocation.lat},${driverLocation.lng}&destination=${destination}&travelmode=driving`, '_blank');

      await fetchOrder();
      toast({ title: 'Navigation Started', description: 'Return here to mark delivery outcome.' });
    } catch (error) {
      console.error('Error starting navigation:', error);
      toast({ title: 'Error', description: 'Failed to start navigation', variant: 'destructive' });
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
      await updateOrderStatus(order.id, order.tracking_id || null, newStatus as any, outcome, locationData || undefined);

      if (driverStartLocationRef.current && destinationCoords) {
        try {
          await supabase.functions.invoke('generate-route-snapshot', {
            body: { orderId: order.id, startLat: driverStartLocationRef.current.lat, startLng: driverStartLocationRef.current.lng, endLat: destinationCoords.lat, endLng: destinationCoords.lng }
          });
        } catch (snapshotError) {
          console.error('Snapshot generation error:', snapshotError);
        }
      }

      toast({ title: isDelivered ? 'Delivery Complete' : 'Delivery Incomplete', description: 'Order status updated successfully.' });
      setShowOutcomeSheet(false);
      navigate(-1);
    } catch (error) {
      console.error('Error updating order:', error);
      toast({ title: 'Error', description: 'Failed to update order status', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusInfo = (status: string | null) => {
    switch (status) {
      case 'PENDING': return { label: 'Pending', variant: 'secondary' as const };
      case 'PICKED_UP_AND_ASSIGNED': return { label: 'Picked Up', variant: 'default' as const };
      case 'CONFIRMED': return { label: 'Confirmed', variant: 'default' as const };
      case 'IN_ROUTE': return { label: 'In Transit', variant: 'default' as const };
      case 'COMPLETED_DELIVERED': return { label: 'Delivered', variant: 'default' as const };
      case 'COMPLETED_INCOMPLETE': return { label: 'Incomplete', variant: 'destructive' as const };
      default: return { label: 'Pending', variant: 'secondary' as const };
    }
  };

  const canStartNavigation = order?.timeline_status === 'PICKED_UP_AND_ASSIGNED' || order?.timeline_status === 'CONFIRMED';
  const canDropOff = order?.timeline_status === 'IN_ROUTE';
  const isCompleted = order?.timeline_status === 'COMPLETED_DELIVERED' || order?.timeline_status === 'COMPLETED_INCOMPLETE';

  const getProgress = () => {
    const s = order?.timeline_status || 'PENDING';
    if (s === 'COMPLETED_DELIVERED' || s === 'COMPLETED_INCOMPLETE') return 100;
    if (s === 'IN_ROUTE' || s === 'CONFIRMED') return 66;
    if (s === 'PICKED_UP_AND_ASSIGNED') return 33;
    return 0;
  };

  if (isLoading) {
    return (
      <AppLayout title="Delivery" showBackButton>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout title="Delivery" showBackButton>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-muted-foreground">
          <Package className="w-12 h-12 mb-2" />
          <p>Order not found</p>
        </div>
      </AppLayout>
    );
  }

  const status = getStatusInfo(order.timeline_status);

  return (
    <AppLayout title="" showBackButton>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
        {/* Collapsible Map Section */}
        <div 
          className={cn(
            'relative bg-muted transition-all duration-300 ease-out overflow-hidden',
            isMapExpanded ? 'h-[50vh]' : 'h-32'
          )}
          onClick={() => setIsMapExpanded(!isMapExpanded)}
        >
          <div ref={mapContainerRef} className="w-full h-full" />
          
          {(!driverLocation || !destinationCoords || !mapLoaded) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Order badge overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold shadow-lg">
              {orderNumber}
            </div>
            <Badge variant={status.variant} className="shadow-lg">{status.label}</Badge>
          </div>

          {/* Expand/collapse indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1 text-xs text-muted-foreground">
            {isMapExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {isMapExpanded ? 'Tap to collapse' : 'Tap to expand'}
          </div>

          {/* Route info overlay (when collapsed) */}
          {!isMapExpanded && routeInfo && (
            <div className="absolute bottom-2 right-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-foreground">{routeInfo.distance}</span>
                <span className="text-muted-foreground">•</span>
                <span className="font-semibold text-foreground">{routeInfo.duration}</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Content - Single Unified Card */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Route Stats (when map expanded) */}
            {isMapExpanded && routeInfo && (
              <div className="flex items-center justify-around py-3 bg-muted/50 rounded-xl">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{routeInfo.distance}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Distance</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{routeInfo.duration}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{routeInfo.arrivalTime}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ETA</p>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
              <MapPin className="w-4 h-4 text-primary" />
            </div>

            {/* Unified Info Section */}
            <div className="space-y-4">
              {/* Shipment Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Shipment</p>
                  <p className="text-xl font-bold text-primary">#{order.shipment_id || order.tracking_id || '—'}</p>
                </div>
                {order.tracking_id && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Tracking</p>
                    <p className="text-sm font-medium text-foreground">{order.tracking_id}</p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Customer & Address */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-semibold text-sm">
                        {order.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{order.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">Customer</p>
                    </div>
                  </div>
                  {order.phone_number && (
                    <a 
                      href={`tel:${order.phone_number}`}
                      className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-4 h-4 text-primary-foreground" />
                    </a>
                  )}
                </div>

                {/* Address */}
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">
                      {order.address_1}{order.address_2 ? `, ${order.address_2}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.city}, {order.province} {order.postal}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Area - Swipe Buttons */}
        {!isCompleted && (
          <div className="p-4 space-y-3 bg-card border-t border-border safe-area-bottom">
            {canStartNavigation && (
              <SwipeButton
                onSwipeComplete={handleStartNavigation}
                label="Slide to Start Navigation"
                icon={<Navigation className="w-5 h-5" />}
                variant="primary"
                disabled={!driverLocation}
                isLoading={isUpdating}
              />
            )}
            {canDropOff && (
              <SwipeButton
                onSwipeComplete={handleDropOff}
                label="Slide to Complete Drop-Off"
                icon={<Package className="w-5 h-5" />}
                variant="secondary"
                disabled={isUpdating}
              />
            )}
          </div>
        )}
      </div>

      {/* Delivery Outcome Bottom Sheet */}
      <Sheet open={showOutcomeSheet} onOpenChange={setShowOutcomeSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh]">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center">Mark Delivery Outcome</SheetTitle>
          </SheetHeader>

          {!outcomeType ? (
            <div className="grid grid-cols-2 gap-3 pb-6">
              <button
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-primary/10 border-2 border-primary text-primary active:scale-95 transition-transform"
                onClick={() => setOutcomeType('delivered')}
              >
                <CheckCircle className="w-8 h-8" />
                <span className="font-semibold">Delivered</span>
              </button>
              <button
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-destructive/10 border-2 border-destructive text-destructive active:scale-95 transition-transform"
                onClick={() => setOutcomeType('incomplete')}
              >
                <XCircle className="w-8 h-8" />
                <span className="font-semibold">Incomplete</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2 pb-6 max-h-[50vh] overflow-y-auto">
              {(outcomeType === 'delivered' ? DELIVERED_OUTCOMES : INCOMPLETE_OUTCOMES).map((outcome) => (
                <button
                  key={outcome.value}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 rounded-xl border text-left active:scale-[0.98] transition-transform',
                    outcomeType === 'delivered' 
                      ? 'border-primary/20 bg-primary/5 text-foreground' 
                      : 'border-destructive/20 bg-destructive/5 text-foreground'
                  )}
                  onClick={() => handleOutcomeSelect(outcome.value, outcomeType === 'delivered')}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : outcomeType === 'delivered' ? (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive" />
                  )}
                  <span className="font-medium">{outcome.label}</span>
                </button>
              ))}
              <Button
                className="w-full mt-4"
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
