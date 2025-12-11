import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface RouteInfo {
  distance: string;
  duration: string;
  arrivalTime: string;
}

interface DeliveryMapboxRouteProps {
  driverLocation: { lat: number; lng: number } | null;
  destinationCoords: { lat: number; lng: number } | null;
  defaultCenter: [number, number];
  isExpanded?: boolean;
  onMapReady?: () => void;
  onRouteInfo?: (info: RouteInfo) => void;
}

export function DeliveryMapboxRoute({ 
  driverLocation, 
  destinationCoords,
  defaultCenter,
  isExpanded,
  onMapReady,
  onRouteInfo
}: DeliveryMapboxRouteProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const mapboxToken = useRef<string | null>(null);
  const isMapLoaded = useRef(false);
  const hasInitialRoute = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to update route
  const updateRoute = useCallback(async () => {
    if (!map.current || !isMapLoaded.current || !driverLocation || !destinationCoords || !mapboxToken.current) return;

    try {
      const routeResponse = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLocation.lng},${driverLocation.lat};${destinationCoords.lng},${destinationCoords.lat}?geometries=geojson&access_token=${mapboxToken.current}`
      );
      const routeData = await routeResponse.json();

      if (routeData.routes && routeData.routes[0]) {
        const route = routeData.routes[0].geometry;
        const routeDetails = routeData.routes[0];

        // Calculate ETA info
        const distanceKm = (routeDetails.distance / 1000).toFixed(1);
        const durationMin = Math.round(routeDetails.duration / 60);
        const arrivalDate = new Date(Date.now() + routeDetails.duration * 1000);
        const arrivalTime = arrivalDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        onRouteInfo?.({
          distance: `${distanceKm} km`,
          duration: `${durationMin} min`,
          arrivalTime
        });

        // Update or create route source/layer
        if (map.current.getSource('route')) {
          (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: route
          });
        } else {
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route
            }
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#F97316',
              'line-width': 6,
              'line-opacity': 0.9
            }
          });
        }

        // Fit bounds
        const coordinates = route.coordinates;
        const bounds = coordinates.reduce((b: mapboxgl.LngLatBounds, coord: [number, number]) => {
          return b.extend(coord as mapboxgl.LngLatLike);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        map.current.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          duration: 500
        });
      }
    } catch (err) {
      console.error('Error fetching route:', err);
    }
  }, [driverLocation, destinationCoords, onRouteInfo]);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initMap = async () => {
      try {
        const { data, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');
        if (tokenError || !data?.token) {
          setError('Failed to load map');
          setIsLoading(false);
          return;
        }

        mapboxToken.current = data.token;
        mapboxgl.accessToken = data.token;

        // Calculate initial center
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

        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/light-v11',
          center,
          zoom: 12,
          attributionControl: false
        });

        map.current.on('load', () => {
          isMapLoaded.current = true;
          setIsLoading(false);
          onMapReady?.();
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
        isMapLoaded.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers and route when coordinates change
  useEffect(() => {
    if (!map.current || !isMapLoaded.current) return;

    // Update driver marker
    if (driverLocation) {
      if (driverMarker.current) {
        driverMarker.current.setLngLat([driverLocation.lng, driverLocation.lat]);
      } else {
        const driverEl = document.createElement('div');
        driverEl.innerHTML = `
          <div style="width: 20px; height: 20px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
        `;
        driverMarker.current = new mapboxgl.Marker(driverEl)
          .setLngLat([driverLocation.lng, driverLocation.lat])
          .addTo(map.current);
      }
    }

    // Update destination marker
    if (destinationCoords) {
      if (destMarker.current) {
        destMarker.current.setLngLat([destinationCoords.lng, destinationCoords.lat]);
      } else {
        const destEl = document.createElement('div');
        destEl.innerHTML = `
          <div style="width: 32px; height: 32px; background: #1a1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
        `;
        destMarker.current = new mapboxgl.Marker(destEl)
          .setLngLat([destinationCoords.lng, destinationCoords.lat])
          .addTo(map.current);
      }
    }

    // Update route only if not already loaded
    if (!hasInitialRoute.current) {
      updateRoute();
      hasInitialRoute.current = true;
    }
  }, [driverLocation, destinationCoords, updateRoute]);

  // Handle resize when expanded state changes
  useEffect(() => {
    if (!map.current) return;
    
    // Small delay to let CSS transition complete
    const timeoutId = setTimeout(() => {
      map.current?.resize();
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [isExpanded]);

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
