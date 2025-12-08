import { useEffect, useRef, useState, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';
import { X, Navigation, Clock, MapPin, CornerUpLeft, CornerUpRight, MoveUp, RotateCcw, MapPinned, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface DirectionStep {
  instruction: string;
  distance: string;
  duration: string;
  maneuver?: string;
}

interface RouteInfo {
  duration: string;
  distance: string;
  steps: DirectionStep[];
}

interface NavigationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  destination: {
    lat: number;
    lng: number;
    city?: string | null;
    postal?: string | null;
    province?: string | null;
    address_1?: string | null;
  } | null;
  driverLocation: { lat: number; lng: number } | null;
}

export function NavigationSheet({ isOpen, onClose, destination, driverLocation }: NavigationSheetProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Get icon for maneuver type
  const getManeuverIcon = (maneuver: string) => {
    if (maneuver.includes('left')) return <CornerUpLeft className="w-5 h-5" />;
    if (maneuver.includes('right')) return <CornerUpRight className="w-5 h-5" />;
    if (maneuver.includes('uturn') || maneuver.includes('u-turn')) return <RotateCcw className="w-5 h-5" />;
    if (maneuver.includes('straight') || maneuver.includes('head') || maneuver.includes('continue')) return <MoveUp className="w-5 h-5" />;
    if (maneuver.includes('destination') || maneuver.includes('arrive')) return <MapPinned className="w-5 h-5" />;
    return <ArrowRight className="w-5 h-5" />;
  };

  // Fetch Google Maps API key
  const fetchApiKey = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      if (error) throw error;
      return data.apiKey;
    } catch (err) {
      console.error('Error fetching Google Maps API key:', err);
      throw new Error('Failed to load map configuration');
    }
  }, []);

  // Initialize map and draw route
  useEffect(() => {
    if (!isOpen || !destination || !driverLocation || !mapContainerRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const apiKey = await fetchApiKey();

        // Set Google Maps API options
        setOptions({
          key: apiKey,
          v: 'weekly',
        });

        // Load required libraries
        await importLibrary('maps');
        await importLibrary('marker');
        if (!isMounted) return;

        // Create map centered between driver and destination
        const centerLat = (driverLocation.lat + destination.lat) / 2;
        const centerLng = (driverLocation.lng + destination.lng) / 2;

        mapRef.current = new google.maps.Map(mapContainerRef.current!, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 13,
          mapId: 'navigation-sheet-map',
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });

        setMapInitialized(true);

        // Draw route
        const directionsService = new google.maps.DirectionsService();
        
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map: mapRef.current,
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: '#f97316',
            strokeWeight: 6,
            strokeOpacity: 0.9
          }
        });

        const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
          directionsService.route({
            origin: new google.maps.LatLng(driverLocation.lat, driverLocation.lng),
            destination: new google.maps.LatLng(destination.lat, destination.lng),
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

        if (!isMounted) return;

        directionsRendererRef.current.setDirections(result);

        const route = result.routes[0];
        const leg = route.legs[0];

        // Extract turn-by-turn directions
        const steps: DirectionStep[] = leg.steps.map(step => ({
          instruction: step.instructions.replace(/<[^>]*>/g, ''),
          distance: step.distance?.text || '',
          duration: step.duration?.text || '',
          maneuver: step.maneuver || ''
        }));

        setRouteInfo({
          duration: leg.duration_in_traffic?.text || leg.duration?.text || '',
          distance: leg.distance?.text || '',
          steps
        });

        setIsLoading(false);
      } catch (err) {
        if (isMounted) {
          console.error('Navigation error:', err);
          setError(err instanceof Error ? err.message : 'Failed to load navigation');
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      mapRef.current = null;
      setMapInitialized(false);
    };
  }, [isOpen, destination, driverLocation, fetchApiKey]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        
        {/* Header with close button */}
        <div className="sticky top-0 z-20 bg-background border-b">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Navigation className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Turn-by-Turn Navigation</h3>
                {destination && (
                  <p className="text-sm text-muted-foreground">
                    {destination.city}, {destination.postal}
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Route summary */}
          {routeInfo && (
            <div className="flex items-center gap-4 px-4 pb-3">
              <Badge variant="secondary" className="flex items-center gap-1.5 text-sm py-1.5 px-3">
                <Clock className="w-4 h-4" />
                {routeInfo.duration}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1.5 text-sm py-1.5 px-3">
                <MapPin className="w-4 h-4" />
                {routeInfo.distance}
              </Badge>
            </div>
          )}
        </div>

        {/* Map container */}
        <div className="relative h-[35%] w-full bg-muted">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading route...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* Directions list */}
        <ScrollArea className="h-[calc(55%-80px)]">
          <div className="p-4 space-y-2">
            {routeInfo?.steps.map((step, index) => (
              <div 
                key={index} 
                className={`flex items-start gap-3 p-3 rounded-xl ${
                  index === 0 
                    ? 'bg-primary/10 border border-primary/20' 
                    : 'bg-muted/50'
                }`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  index === 0 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted-foreground/20 text-muted-foreground'
                }`}>
                  {getManeuverIcon(step.maneuver || '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${index === 0 ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                    {step.instruction}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{step.distance}</span>
                    {step.duration && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{step.duration}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Arrival indicator */}
            {routeInfo && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center">
                  <MapPinned className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">Arrive at destination</p>
                  {destination && (
                    <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                      {destination.address_1 ? `${destination.address_1}, ` : ''}
                      {destination.city}, {destination.postal}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
