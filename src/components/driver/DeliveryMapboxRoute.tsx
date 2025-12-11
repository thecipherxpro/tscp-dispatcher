import { useEffect, useRef, useState } from 'react';
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
  onMapReady?: () => void;
  onRouteInfo?: (info: RouteInfo) => void;
}

export function DeliveryMapboxRoute({ 
  driverLocation, 
  destinationCoords,
  defaultCenter,
  onMapReady,
  onRouteInfo
}: DeliveryMapboxRouteProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const initMap = async () => {
      try {
        // Fetch Mapbox token from edge function
        const { data, error: tokenError } = await supabase.functions.invoke('get-mapbox-token');
        if (tokenError || !data?.token) {
          setError('Failed to load map');
          setIsLoading(false);
          return;
        }

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

        // Initialize Mapbox GL map
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/light-v11',
          center,
          zoom: 12,
          attributionControl: false
        });

        map.current.on('load', async () => {
          if (!map.current) return;

          // Add driver marker (blue dot)
          if (driverLocation) {
            const driverEl = document.createElement('div');
            driverEl.innerHTML = `
              <div style="width: 20px; height: 20px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
            `;
            new mapboxgl.Marker(driverEl)
              .setLngLat([driverLocation.lng, driverLocation.lat])
              .addTo(map.current);
          }

          // Add destination marker (white home icon in black circle)
          if (destinationCoords) {
            const destEl = document.createElement('div');
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

          // Fetch and draw route from Mapbox Directions API
          if (driverLocation && destinationCoords) {
            try {
              const routeResponse = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLocation.lng},${driverLocation.lat};${destinationCoords.lng},${destinationCoords.lat}?geometries=geojson&access_token=${data.token}`
              );
              const routeData = await routeResponse.json();

              if (routeData.routes && routeData.routes[0]) {
                const route = routeData.routes[0].geometry;
                const routeDetails = routeData.routes[0];

                // Calculate ETA info from Mapbox response
                const distanceKm = (routeDetails.distance / 1000).toFixed(1);
                const durationMin = Math.round(routeDetails.duration / 60);
                const arrivalDate = new Date(Date.now() + routeDetails.duration * 1000);
                const arrivalTime = arrivalDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });

                // Send route info to parent
                onRouteInfo?.({
                  distance: `${distanceKm} km`,
                  duration: `${durationMin} min`,
                  arrivalTime
                });

                // Check if source already exists before adding
                if (map.current!.getSource('route')) {
                  (map.current!.getSource('route') as mapboxgl.GeoJSONSource).setData({
                    type: 'Feature',
                    properties: {},
                    geometry: route
                  });
                } else {
                  // Add route source and layer
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
                      'line-color': '#F97316', // Orange
                      'line-width': 6,
                      'line-opacity': 0.9
                    }
                  });
                }

                // Fit map bounds to show entire route
                const coordinates = route.coordinates;
                const bounds = coordinates.reduce((bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
                  return bounds.extend(coord as mapboxgl.LngLatLike);
                }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

                map.current!.fitBounds(bounds, {
                  padding: { top: 50, bottom: 50, left: 50, right: 50 }
                });
              } else {
                // Fallback: draw straight line if no route available
                drawStraightLine(driverLocation, destinationCoords);
              }
            } catch (routeErr) {
              console.error('Error fetching route:', routeErr);
              // Fallback: draw straight line
              drawStraightLine(driverLocation, destinationCoords);
            }
          }

          setIsLoading(false);
          onMapReady?.();
        });

        map.current.on('error', () => {
          setError('Map failed to load');
          setIsLoading(false);
        });

        // Set up ResizeObserver to handle container size changes
        resizeObserver.current = new ResizeObserver(() => {
          if (map.current) {
            map.current.resize();
          }
        });
        resizeObserver.current.observe(mapContainer.current!);

      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to initialize map');
        setIsLoading(false);
      }
    };

    const drawStraightLine = (driver: { lat: number; lng: number }, dest: { lat: number; lng: number }) => {
      if (!map.current) return;
      
      const lineData = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [driver.lng, driver.lat],
            [dest.lng, dest.lat]
          ]
        }
      };

      // Check if source already exists
      if (map.current.getSource('route')) {
        (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(lineData);
      } else {
        map.current.addSource('route', {
          type: 'geojson',
          data: lineData
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
      const bounds = new mapboxgl.LngLatBounds()
        .extend([driver.lng, driver.lat])
        .extend([dest.lng, dest.lat]);
      
      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 }
      });
    };

    initMap();

    return () => {
      resizeObserver.current?.disconnect();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [driverLocation, destinationCoords, defaultCenter, onMapReady]);

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
