import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Navigation, Package, CheckCircle, XCircle, MapPin, Clock, ChevronUp, ChevronDown, Phone } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

// Custom driver marker (blue dot)
const driverIcon = L.divIcon({
  className: 'driver-marker',
  html: '<div style="width:16px;height:16px;background:#3B82F6;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Custom destination marker (house icon)
const destinationIcon = L.divIcon({
  className: 'destination-marker',
  html: `<svg width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="16" fill="#1f2937" stroke="#fff" stroke-width="2"/>
    <path d="M20 12L12 18V28H17V23H23V28H28V18L20 12Z" fill="#fff"/>
  </svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Component to fit map bounds
function MapBoundsUpdater({ driverLocation, destinationCoords }: { driverLocation: { lat: number; lng: number } | null; destinationCoords: { lat: number; lng: number } | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (driverLocation && destinationCoords) {
      const bounds = L.latLngBounds([
        [driverLocation.lat, driverLocation.lng],
        [destinationCoords.lat, destinationCoords.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (driverLocation) {
      map.setView([driverLocation.lat, driverLocation.lng], 14);
    } else if (destinationCoords) {
      map.setView([destinationCoords.lat, destinationCoords.lng], 14);
    }
  }, [map, driverLocation, destinationCoords]);
  
  return null;
}

// Cache Google Maps API key for route calculation only
let googleMapsApiKey: string | null = null;

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
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const driverStartLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const { fetchLocation, locationData } = useDriverLocation();
  const haptic = useHapticFeedback();

  const orderNumber = (location.state as { orderNumber?: number })?.orderNumber || 1;

  // Fetch Google Maps API key for route calculation
  useEffect(() => {
    const fetchApiKey = async () => {
      if (!googleMapsApiKey) {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        if (!error && data?.apiKey) {
          googleMapsApiKey = data.apiKey;
        }
      }
    };
    fetchApiKey();
  }, []);

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
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    }
  }, []);

  useEffect(() => {
    fetchOrder();
    getDriverLocation();
    fetchLocation();
  }, [fetchOrder, getDriverLocation, fetchLocation]);

  // Set destination coordinates from order
  useEffect(() => {
    if (!order) return;
    if (order.latitude && order.longitude) {
      setDestinationCoords({ lat: order.latitude, lng: order.longitude });
    }
  }, [order]);

  // Fetch route from Google Directions API (for accurate routing)
  useEffect(() => {
    if (!driverLocation || !destinationCoords || !googleMapsApiKey) return;

    const fetchRoute = async () => {
      try {
        const origin = `${driverLocation.lat},${driverLocation.lng}`;
        const destination = `${destinationCoords.lat},${destinationCoords.lng}`;
        
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${googleMapsApiKey}`
        );
        
        // Note: Due to CORS, we'll use a simpler approach - just draw a straight line
        // and use distance matrix for accurate time/distance
        
        // For now, draw simple route line
        setRouteCoords([
          [driverLocation.lat, driverLocation.lng],
          [destinationCoords.lat, destinationCoords.lng]
        ]);

        // Calculate rough distance and time
        const R = 6371; // Earth's radius in km
        const dLat = (destinationCoords.lat - driverLocation.lat) * Math.PI / 180;
        const dLon = (destinationCoords.lng - driverLocation.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(driverLocation.lat * Math.PI / 180) * Math.cos(destinationCoords.lat * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        // Rough estimate: 30 km/h average city driving
        const durationMin = Math.round((distance / 30) * 60);
        const arrivalDate = new Date(Date.now() + durationMin * 60000);
        
        setRouteInfo({
          distance: `${distance.toFixed(1)} km`,
          duration: `${durationMin} min`,
          arrivalTime: arrivalDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        });
        
        setMapReady(true);
      } catch (error) {
        console.error('Error fetching route:', error);
        // Still show the map with a simple line
        setRouteCoords([
          [driverLocation.lat, driverLocation.lng],
          [destinationCoords.lat, destinationCoords.lng]
        ]);
        setMapReady(true);
      }
    };

    fetchRoute();
  }, [driverLocation, destinationCoords]);

  // Geocode address if no coordinates (using Nominatim - free geocoding)
  useEffect(() => {
    if (!order || destinationCoords) return;
    if (order.latitude && order.longitude) return;
    if (!order.address_1) return;

    const geocodeAddress = async () => {
      try {
        const address = `${order.address_1}, ${order.city || ''}, ${order.province || ''} ${order.postal || ''}, Canada`;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
        );
        const data = await response.json();
        if (data && data[0]) {
          setDestinationCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    };

    geocodeAddress();
  }, [order, destinationCoords]);

  const openNativeMapApp = (destLat: number, destLng: number, destAddress: string) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
      // iOS - Apple Maps
      window.location.href = `maps://maps.apple.com/?daddr=${destLat},${destLng}&dirflg=d`;
    } else if (isAndroid) {
      // Android - Google Maps app via intent
      window.location.href = `geo:${destLat},${destLng}?q=${destLat},${destLng}(${encodeURIComponent(destAddress)})`;
      // Fallback to Google Maps app URL scheme after short delay
      setTimeout(() => {
        window.location.href = `google.navigation:q=${destLat},${destLng}&mode=d`;
      }, 100);
    } else {
      // Desktop/fallback - Open Google Maps in new tab
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`,
        '_blank'
      );
    }
  };

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

      // Open native map app
      const destLat = destinationCoords?.lat || order.latitude;
      const destLng = destinationCoords?.lng || order.longitude;
      const destAddress = `${order.address_1 || ''}, ${order.city || ''}`;
      
      if (destLat && destLng) {
        openNativeMapApp(destLat, destLng, destAddress);
      }

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
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
          <Skeleton className="h-32 w-full" />
          <div className="p-4 space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
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
  const defaultCenter: [number, number] = driverLocation 
    ? [driverLocation.lat, driverLocation.lng] 
    : [43.6532, -79.3832]; // Toronto default

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
          {/* Skeleton loader while map loads */}
          {!mapReady && (
            <div className="absolute inset-0 bg-muted z-20">
              <div className="w-full h-full relative overflow-hidden">
                <Skeleton className="absolute inset-0 rounded-none" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">Loading map...</span>
                  </div>
                </div>
                {/* Fake road lines */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-muted-foreground/10 transform -translate-y-1/2" />
                <div className="absolute top-1/3 left-1/4 right-1/4 h-0.5 bg-muted-foreground/10" />
                <div className="absolute bottom-1/3 left-1/3 right-1/3 h-0.5 bg-muted-foreground/10" />
              </div>
            </div>
          )}

          {/* Leaflet Map */}
          <MapContainer
            center={defaultCenter}
            zoom={13}
            className="w-full h-full"
            zoomControl={false}
            attributionControl={false}
            style={{ background: '#f5f5f5' }}
          >
            {/* Light/Minimal tile layer - CartoDB Positron (light gray) */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            
            {/* Update bounds when locations change */}
            <MapBoundsUpdater driverLocation={driverLocation} destinationCoords={destinationCoords} />
            
            {/* Route line */}
            {routeCoords.length > 0 && (
              <Polyline
                positions={routeCoords}
                pathOptions={{
                  color: '#F97316',
                  weight: 5,
                  opacity: 1,
                }}
              />
            )}
            
            {/* Driver marker */}
            {driverLocation && (
              <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} />
            )}
            
            {/* Destination marker */}
            {destinationCoords && (
              <Marker position={[destinationCoords.lat, destinationCoords.lng]} icon={destinationIcon} />
            )}
          </MapContainer>

          {/* Order badge overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-2 z-[1000]">
            <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold shadow-lg">
              {orderNumber}
            </div>
            <Badge variant={status.variant} className="shadow-lg">{status.label}</Badge>
          </div>

          {/* Expand/collapse indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1 text-xs text-muted-foreground z-[1000]">
            {isMapExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {isMapExpanded ? 'Tap to collapse' : 'Tap to expand'}
          </div>

          {/* Route info overlay (when collapsed) */}
          {!isMapExpanded && routeInfo && (
            <div className="absolute bottom-2 right-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg z-[1000]">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-foreground">{routeInfo.distance}</span>
                <span className="text-muted-foreground">•</span>
                <span className="font-semibold text-foreground">{routeInfo.duration}</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Route Stats (when map expanded) */}
            {isMapExpanded && routeInfo && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-card border rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className="font-semibold text-foreground">{routeInfo.distance}</p>
                </div>
                <div className="bg-card border rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-semibold text-foreground">{routeInfo.duration}</p>
                </div>
                <div className="bg-card border rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">ETA</p>
                  <p className="font-semibold text-foreground">{routeInfo.arrivalTime}</p>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Delivery Progress</span>
                <span className="text-xs text-muted-foreground">{getProgress()}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>

            {/* Unified Info Card */}
            <div className="bg-card border rounded-xl overflow-hidden">
              {/* Shipment Info */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Shipment</p>
                    <p className="font-semibold text-foreground">{order.shipment_id || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Tracking</p>
                    <p className="text-sm font-medium text-foreground">{order.tracking_id || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-bold text-muted-foreground">
                      {order.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{order.name || 'Customer'}</p>
                    <p className="text-sm text-muted-foreground">{order.phone_number || 'No phone'}</p>
                  </div>
                  {order.phone_number && (
                    <a href={`tel:${order.phone_number}`} onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="outline" className="rounded-full">
                        <Phone className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Delivery Address</p>
                    <p className="font-medium text-foreground">{order.address_1}</p>
                    {order.address_2 && <p className="text-sm text-muted-foreground">{order.address_2}</p>}
                    <p className="text-sm text-muted-foreground">
                      {[order.city, order.province, order.postal].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Completed Status Card */}
            {isCompleted && (
              <div className={cn(
                'rounded-xl p-4 flex items-center gap-3',
                order.timeline_status === 'COMPLETED_DELIVERED' 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-destructive/10 border border-destructive/20'
              )}>
                {order.timeline_status === 'COMPLETED_DELIVERED' ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-destructive" />
                )}
                <div>
                  <p className="font-medium text-foreground">
                    {order.timeline_status === 'COMPLETED_DELIVERED' ? 'Delivery Complete' : 'Delivery Incomplete'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.delivery_status?.replace(/_/g, ' ') || 'Status recorded'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Bar */}
        {!isCompleted && (
          <div className="p-4 border-t bg-background safe-area-bottom">
            {canStartNavigation && (
              <SwipeButton
                onSwipeComplete={handleStartNavigation}
                disabled={isUpdating || !driverLocation}
                label="Swipe to Start Navigation"
                icon={<Navigation className="w-5 h-5" />}
              />
            )}
            {canDropOff && (
              <SwipeButton
                onSwipeComplete={handleDropOff}
                disabled={isUpdating}
                variant="success"
                label="Swipe to Complete Drop-Off"
                icon={<CheckCircle className="w-5 h-5" />}
              />
            )}
          </div>
        )}
      </div>

      {/* Delivery Outcome Sheet */}
      <Sheet open={showOutcomeSheet} onOpenChange={setShowOutcomeSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center">
              {outcomeType === null ? 'Select Delivery Outcome' : outcomeType === 'delivered' ? 'Delivery Successful' : 'Delivery Issue'}
            </SheetTitle>
          </SheetHeader>

          {outcomeType === null ? (
            <div className="grid grid-cols-2 gap-3 pb-6">
              <Button
                size="lg"
                className="h-24 flex-col gap-2 bg-green-500 hover:bg-green-600 text-white"
                onClick={() => setOutcomeType('delivered')}
              >
                <CheckCircle className="w-8 h-8" />
                <span>Delivered</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-24 flex-col gap-2 border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => setOutcomeType('incomplete')}
              >
                <XCircle className="w-8 h-8" />
                <span>Issue</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-2 pb-6">
              {(outcomeType === 'delivered' ? DELIVERED_OUTCOMES : INCOMPLETE_OUTCOMES).map((outcome) => (
                <Button
                  key={outcome.value}
                  variant="outline"
                  className="w-full justify-start h-14 text-left"
                  onClick={() => handleOutcomeSelect(outcome.value, outcomeType === 'delivered')}
                  disabled={isUpdating}
                >
                  {outcome.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                className="w-full"
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
