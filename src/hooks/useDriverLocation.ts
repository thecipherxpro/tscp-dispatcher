import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LocationData {
  ip_address: string | null;
  geolocation: string | null;
  access_location: string | null;
}

// Fetch IP address using public API
async function fetchIPAddress(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json', { 
      signal: AbortSignal.timeout(3000) 
    });
    if (response.ok) {
      const data = await response.json();
      return data.ip || null;
    }
  } catch (error) {
    console.error('Failed to fetch IP address:', error);
  }
  return null;
}

// Get Mapbox token from edge function
async function getMapboxToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('get-mapbox-token');
    if (error) throw error;
    return data?.token || null;
  } catch (error) {
    console.error('Failed to get Mapbox token:', error);
    return null;
  }
}

// Get browser geolocation
function getBrowserGeolocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Geolocation error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 3000,
        maximumAge: 300000,
      }
    );
  });
}

// Reverse geocode coordinates using Mapbox API
async function reverseGeocodeWithMapbox(lat: number, lng: number, token: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=place,locality,neighborhood`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].place_name || null;
      }
    }
  } catch (error) {
    console.error('Mapbox reverse geocoding failed:', error);
  }
  return null;
}

// Fallback to Nominatim if Mapbox fails
async function reverseGeocodeNominatim(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      {
        headers: { 'User-Agent': 'TSCP-Delivery-App' },
        signal: AbortSignal.timeout(5000)
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const parts = [];
      if (data.address?.city || data.address?.town || data.address?.village) {
        parts.push(data.address.city || data.address.town || data.address.village);
      }
      if (data.address?.state || data.address?.province) {
        parts.push(data.address.state || data.address.province);
      }
      if (data.address?.country) {
        parts.push(data.address.country);
      }
      return parts.length > 0 ? parts.join(', ') : null;
    }
  } catch (error) {
    console.error('Nominatim reverse geocoding failed:', error);
  }
  return null;
}

// Main function to fetch all location data
export async function fetchDriverLocationData(): Promise<LocationData> {
  // Fetch IP address immediately - this is fast and reliable
  const ipAddress = await fetchIPAddress();
  
  // Get coords in parallel with mapbox token
  const [coords, mapboxToken] = await Promise.all([
    getBrowserGeolocation(),
    getMapboxToken(),
  ]);

  let geolocation: string | null = null;
  let accessLocation: string | null = null;

  if (coords) {
    geolocation = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    
    // Try Mapbox first, fallback to Nominatim
    if (mapboxToken) {
      accessLocation = await reverseGeocodeWithMapbox(coords.lat, coords.lng, mapboxToken);
    }
    if (!accessLocation) {
      accessLocation = await reverseGeocodeNominatim(coords.lat, coords.lng);
    }
  }

  return {
    ip_address: ipAddress,
    geolocation,
    access_location: accessLocation,
  };
}

export function useDriverLocation() {
  const [isLoading, setIsLoading] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);

  const fetchLocation = useCallback(async (): Promise<LocationData> => {
    setIsLoading(true);
    try {
      const data = await fetchDriverLocationData();
      setLocationData(data);
      return data;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    fetchLocation,
    locationData,
    isLoading,
  };
}
