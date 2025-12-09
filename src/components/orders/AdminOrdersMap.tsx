import { useEffect, useRef, useState, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';
import { Order } from '@/types/auth';
import { Loader2, AlertCircle, MapPin, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AdminOrdersMapProps {
  orders: Order[];
  onOrderSelect: (order: Order) => void;
}

type GeoZone = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

const CITY_CENTER_LAT = 43.6532;
const CITY_CENTER_LNG = -79.3832;

// Uber-style map styling - high contrast, de-cluttered
const UBER_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e8f5e9' }, { visibility: 'simplified' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e4f5' }] },
];

function determineGeoZone(lat: number, lng: number): GeoZone {
  if (lat > CITY_CENTER_LAT) return 'NORTH';
  if (lat < CITY_CENTER_LAT) return 'SOUTH';
  if (lng > CITY_CENTER_LNG) return 'EAST';
  return 'WEST';
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING': return '#f59e0b';
    case 'PICKED_UP_AND_ASSIGNED': return '#3b82f6';
    case 'CONFIRMED': return '#6366f1';
    case 'IN_ROUTE': return '#8b5cf6';
    case 'COMPLETED_DELIVERED': return '#10b981';
    case 'COMPLETED_INCOMPLETE': return '#ef4444';
    case 'REVIEW_REQUESTED': return '#f59e0b';
    default: return '#6b7280';
  }
};

export function AdminOrdersMap({ orders, onOrderSelect }: AdminOrdersMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<GeoZone | null>(null);
  const [zoneCounts, setZoneCounts] = useState<Record<GeoZone, number>>({ NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 });
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  const fetchApiKey = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('get-google-maps-key');
    if (error) throw error;
    return data.apiKey;
  }, []);

  const updateMarkers = useCallback(async (ordersToShow: Order[]) => {
    if (!mapRef.current || !googleMapsLoaded) return;

    markersRef.current.forEach(marker => marker.map = null);
    markersRef.current = [];

    const { AdvancedMarkerElement } = await importLibrary('marker') as google.maps.MarkerLibrary;

    for (const order of ordersToShow) {
      if (!order.latitude || !order.longitude) continue;

      const statusColor = getStatusColor(order.timeline_status);
      const markerElement = document.createElement('div');
      markerElement.className = 'flex items-center justify-center w-8 h-8 rounded-full shadow-lg cursor-pointer transition-transform hover:scale-110';
      markerElement.style.backgroundColor = statusColor;
      markerElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

      const marker = new AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: order.latitude, lng: order.longitude },
        content: markerElement,
        title: order.name || 'Order',
      });

      marker.addListener('click', () => onOrderSelect(order));
      markersRef.current.push(marker);
    }

    if (ordersToShow.length > 0 && mapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      ordersToShow.forEach(order => {
        if (order.latitude && order.longitude) {
          bounds.extend({ lat: order.latitude, lng: order.longitude });
        }
      });
      mapRef.current.fitBounds(bounds, 50);
    }
  }, [googleMapsLoaded, onOrderSelect]);

  useEffect(() => {
    const counts: Record<GeoZone, number> = { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 };
    orders.forEach(order => {
      if (order.latitude && order.longitude) {
        counts[determineGeoZone(order.latitude, order.longitude)]++;
      }
    });
    setZoneCounts(counts);
  }, [orders]);

  useEffect(() => {
    if (!googleMapsLoaded) return;
    const filtered = selectedZone 
      ? orders.filter(o => o.latitude && o.longitude && determineGeoZone(o.latitude!, o.longitude!) === selectedZone)
      : orders;
    updateMarkers(filtered);
  }, [orders, selectedZone, googleMapsLoaded, updateMarkers]);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapContainer.current) return;
      try {
        const apiKey = await fetchApiKey();
        setOptions({ key: apiKey, v: 'weekly' });
        await importLibrary('maps');
        await importLibrary('marker');
        if (!isMounted) return;
        setGoogleMapsLoaded(true);

        mapRef.current = new google.maps.Map(mapContainer.current, {
          center: { lat: CITY_CENTER_LAT, lng: CITY_CENTER_LNG },
          zoom: 11,
          mapId: 'admin-orders-map',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        });
        setIsLoading(false);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load map');
          setIsLoading(false);
        }
      }
    };

    initMap();
    return () => {
      isMounted = false;
      markersRef.current.forEach(marker => marker.map = null);
    };
  }, [fetchApiKey]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const ordersWithCoords = orders.filter(o => o.latitude && o.longitude);
  const filteredCount = selectedZone 
    ? ordersWithCoords.filter(o => determineGeoZone(o.latitude!, o.longitude!) === selectedZone).length
    : ordersWithCoords.length;

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainer} className="absolute inset-0" />
      <div className="absolute top-4 left-4 right-4 z-10">
        <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Compass className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Filter by Zone</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['NORTH', 'SOUTH', 'EAST', 'WEST'] as GeoZone[]).map((zone) => (
                <Button
                  key={zone}
                  variant={selectedZone === zone ? 'default' : 'outline'}
                  size="sm"
                  className="flex flex-col h-auto py-2"
                  onClick={() => setSelectedZone(selectedZone === zone ? null : zone)}
                  disabled={zoneCounts[zone] === 0}
                >
                  <span className="text-xs">{zone}</span>
                  <span className="text-lg font-bold">{zoneCounts[zone]}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="absolute top-28 left-4 z-10">
        <Badge variant="secondary" className="bg-background/90 shadow-md">
          <MapPin className="w-3 h-3 mr-1" />
          {filteredCount} orders{selectedZone && ` in ${selectedZone}`}
        </Badge>
      </div>
    </div>
  );
}