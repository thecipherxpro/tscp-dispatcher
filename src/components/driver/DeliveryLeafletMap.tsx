import { useEffect, useState } from 'react';

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
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  useEffect(() => {
    // Build a static map URL using OpenStreetMap tiles via StaticMap API alternative
    // We'll use a simple approach with markers
    const buildMapUrl = () => {
      const centerLat = destinationCoords?.lat || driverLocation?.lat || defaultCenter[0];
      const centerLng = destinationCoords?.lng || driverLocation?.lng || defaultCenter[1];
      
      // Calculate bounds for zoom
      let zoom = 13;
      if (driverLocation && destinationCoords) {
        const latDiff = Math.abs(driverLocation.lat - destinationCoords.lat);
        const lngDiff = Math.abs(driverLocation.lng - destinationCoords.lng);
        const maxDiff = Math.max(latDiff, lngDiff);
        if (maxDiff > 0.1) zoom = 11;
        if (maxDiff > 0.2) zoom = 10;
        if (maxDiff > 0.5) zoom = 9;
      }

      // Build markers string for static map
      let markers = '';
      if (driverLocation) {
        markers += `&markers=color:blue|${driverLocation.lat},${driverLocation.lng}`;
      }
      if (destinationCoords) {
        markers += `&markers=color:red|${destinationCoords.lat},${destinationCoords.lng}`;
      }

      // Use OpenStreetMap static image service
      const osmUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=600x400&maptype=osmarenderer${markers}`;
      
      setMapUrl(osmUrl);
    };

    buildMapUrl();
  }, [driverLocation, destinationCoords, defaultCenter]);

  return (
    <div className="w-full h-full bg-muted relative overflow-hidden">
      {/* Static Map Image */}
      {mapUrl ? (
        <img 
          src={mapUrl} 
          alt="Delivery route map"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to simple tile background
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      
      {/* Fallback gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/10 -z-10" />
      
      {/* Simple visual representation */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Route visualization overlay */}
        {driverLocation && destinationCoords && (
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
            </defs>
            <line 
              x1="30%" y1="70%" 
              x2="70%" y2="30%" 
              stroke="url(#routeGradient)" 
              strokeWidth="4" 
              strokeDasharray="8,4"
              strokeLinecap="round"
            />
            {/* Driver point */}
            <circle cx="30%" cy="70%" r="8" fill="#3B82F6" stroke="white" strokeWidth="3" />
            {/* Destination point */}
            <circle cx="70%" cy="30%" r="10" fill="#1f2937" stroke="white" strokeWidth="3" />
          </svg>
        )}
      </div>
      
      {/* Map tiles background pattern */}
      <div 
        className="absolute inset-0 opacity-30 -z-5"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
    </div>
  );
}