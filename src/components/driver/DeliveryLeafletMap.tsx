import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
function MapBoundsUpdater({ 
  driverLocation, 
  destinationCoords 
}: { 
  driverLocation: { lat: number; lng: number } | null; 
  destinationCoords: { lat: number; lng: number } | null;
}) {
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

interface DeliveryLeafletMapProps {
  driverLocation: { lat: number; lng: number } | null;
  destinationCoords: { lat: number; lng: number } | null;
  routeCoords: [number, number][];
  defaultCenter: [number, number];
}

export function DeliveryLeafletMap({ 
  driverLocation, 
  destinationCoords, 
  routeCoords, 
  defaultCenter 
}: DeliveryLeafletMapProps) {
  return (
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
  );
}