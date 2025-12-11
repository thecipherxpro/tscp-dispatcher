import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryLeafletMapProps {
  driverLocation: { lat: number; lng: number } | null;
  destinationCoords: { lat: number; lng: number } | null;
  routeCoords: [number, number][];
  defaultCenter: [number, number];
}

export function DeliveryLeafletMap({ 
  driverLocation, 
  destinationCoords, 
  defaultCenter 
}: DeliveryLeafletMapProps) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const buildMapUrl = async () => {
      try {
        // Fetch Mapbox token
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error || !data?.token) {
          console.error('Failed to get Mapbox token');
          setIsLoading(false);
          return;
        }

        const token = data.token;
        const width = 600;
        const height = 400;
        
        // Build markers
        let markers = '';
        
        if (driverLocation) {
          // Blue pin for driver
          markers += `pin-s+3B82F6(${driverLocation.lng},${driverLocation.lat}),`;
        }
        
        if (destinationCoords) {
          // Red pin for destination
          markers += `pin-l+EF4444(${destinationCoords.lng},${destinationCoords.lat})`;
        }
        
        // Remove trailing comma
        markers = markers.replace(/,$/, '');
        
        // Calculate center and zoom
        let centerLng = defaultCenter[1];
        let centerLat = defaultCenter[0];
        let zoom = 13;
        
        if (driverLocation && destinationCoords) {
          // Auto-fit to show both points
          centerLng = (driverLocation.lng + destinationCoords.lng) / 2;
          centerLat = (driverLocation.lat + destinationCoords.lat) / 2;
          
          // Calculate zoom based on distance
          const latDiff = Math.abs(driverLocation.lat - destinationCoords.lat);
          const lngDiff = Math.abs(driverLocation.lng - destinationCoords.lng);
          const maxDiff = Math.max(latDiff, lngDiff);
          
          if (maxDiff > 0.3) zoom = 10;
          else if (maxDiff > 0.15) zoom = 11;
          else if (maxDiff > 0.08) zoom = 12;
          else zoom = 13;
        } else if (driverLocation) {
          centerLng = driverLocation.lng;
          centerLat = driverLocation.lat;
        } else if (destinationCoords) {
          centerLng = destinationCoords.lng;
          centerLat = destinationCoords.lat;
        }
        
        // Build Mapbox Static API URL with light style
        const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${markers ? markers + '/' : ''}${centerLng},${centerLat},${zoom},0/${width}x${height}@2x?access_token=${token}`;
        
        setMapUrl(staticUrl);
        setIsLoading(false);
      } catch (err) {
        console.error('Error building map URL:', err);
        setIsLoading(false);
      }
    };

    buildMapUrl();
  }, [driverLocation, destinationCoords, defaultCenter]);

  return (
    <div className="w-full h-full bg-muted relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}
      
      {mapUrl && (
        <img 
          src={mapUrl} 
          alt="Delivery route map"
          className="w-full h-full object-cover"
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
      )}
      
      {/* Fallback if no map URL */}
      {!mapUrl && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-xs">Map unavailable</span>
          </div>
        </div>
      )}
    </div>
  );
}