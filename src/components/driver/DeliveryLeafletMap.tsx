import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const initMap = async () => {
      try {
        // Fetch Mapbox token
        const { data, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');
        if (tokenError || !data?.token) {
          setError('Failed to load map');
          setIsLoading(false);
          return;
        }

        mapboxgl.accessToken = data.token;

        // Calculate center and bounds
        let center: [number, number] = [defaultCenter[1], defaultCenter[0]];
        
        if (driverLocation && destinationCoords) {
          center = [
            (driverLocation.lng + destinationCoords.lng) / 2,
            (driverLocation.lat + destinationCoords.lat) / 2
          ];
        } else if (driverLocation) {
          center = [driverLocation.lng, driverLocation.lat];
        } else if (destinationCoords) {
          center = [destinationCoords.lng, destinationCoords.lat];
        }

        // Initialize map
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/light-v11',
          center,
          zoom: 12,
          attributionControl: false
        });

        map.current.on('load', async () => {
          if (!map.current) return;

          // Add driver marker
          if (driverLocation) {
            const driverEl = document.createElement('div');
            driverEl.className = 'driver-marker';
            driverEl.innerHTML = `
              <div style="width: 20px; height: 20px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
            `;
            new mapboxgl.Marker(driverEl)
              .setLngLat([driverLocation.lng, driverLocation.lat])
              .addTo(map.current);
          }

          // Add destination marker
          if (destinationCoords) {
            const destEl = document.createElement('div');
            destEl.className = 'destination-marker';
            destEl.innerHTML = `
              <div style="width: 32px; height: 32px; background: #1a1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
            `;
            new mapboxgl.Marker(destEl)
              .setLngLat([destinationCoords.lng, destinationCoords.lat])
              .addTo(map.current);
          }

          // Fetch and display route
          if (driverLocation && destinationCoords) {
            try {
              const routeResponse = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLocation.lng},${driverLocation.lat};${destinationCoords.lng},${destinationCoords.lat}?geometries=geojson&access_token=${data.token}`
              );
              const routeData = await routeResponse.json();

              if (routeData.routes && routeData.routes[0]) {
                const route = routeData.routes[0].geometry;

                map.current!.addSource('route', {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    properties: {},
                    geometry: route
                  }
                });

                map.current!.addLayer({
                  id: 'route',
                  type: 'line',
                  source: 'route',
                  layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                  },
                  paint: {
                    'line-color': '#F97316',
                    'line-width': 5,
                    'line-opacity': 0.9
                  }
                });

                // Fit bounds to show full route
                const coordinates = route.coordinates;
                const bounds = coordinates.reduce((bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
                  return bounds.extend(coord as mapboxgl.LngLatLike);
                }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

                map.current!.fitBounds(bounds, {
                  padding: { top: 50, bottom: 50, left: 50, right: 50 }
                });
              }
            } catch (routeErr) {
              console.error('Error fetching route:', routeErr);
            }
          }

          setIsLoading(false);
        });

        map.current.on('error', () => {
          setError('Map failed to load');
          setIsLoading(false);
        });

      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to initialize map');
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [driverLocation, destinationCoords, defaultCenter]);

  return (
    <div className="w-full h-full bg-muted relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}
      
      <div ref={mapContainer} className="w-full h-full" />
      
      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-xs">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
