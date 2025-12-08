import { useState, useCallback } from 'react';

interface LocationData {
  ip_address: string | null;
  geolocation: string | null;
  access_location: string | null;
}

// Fetch IP address using public API
async function fetchIPAddress(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (response.ok) {
      const data = await response.json();
      return data.ip || null;
    }
  } catch (error) {
    console.error('Failed to fetch IP address:', error);
  }
  return null;
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
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

// Reverse geocode coordinates to get location name
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    // Using Nominatim (OpenStreetMap) for reverse geocoding - free and no API key required
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      {
        headers: {
          'User-Agent': 'TSCP-Delivery-App',
        },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      // Build a readable location string
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
    console.error('Reverse geocoding failed:', error);
  }
  return null;
}

// Main function to fetch all location data
export async function fetchDriverLocationData(): Promise<LocationData> {
  const [ipAddress, coords] = await Promise.all([
    fetchIPAddress(),
    getBrowserGeolocation(),
  ]);

  let geolocation: string | null = null;
  let accessLocation: string | null = null;

  if (coords) {
    geolocation = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    accessLocation = await reverseGeocode(coords.lat, coords.lng);
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
