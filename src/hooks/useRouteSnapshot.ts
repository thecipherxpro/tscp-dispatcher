import { supabase } from '@/integrations/supabase/client';

interface GenerateSnapshotParams {
  orderId: string;
  driverLat: number;
  driverLng: number;
  destinationLat: number;
  destinationLng: number;
  trackingId?: string;
}

/**
 * Generate a route snapshot for a completed delivery
 * This captures the driven route as a static image for audit/compliance
 */
export async function generateRouteSnapshot(params: GenerateSnapshotParams): Promise<{
  success: boolean;
  snapshotUrl?: string;
  error?: string;
}> {
  try {
    console.log('Generating route snapshot for order:', params.orderId);
    
    const { data, error } = await supabase.functions.invoke('generate-route-snapshot', {
      body: params,
    });

    if (error) {
      console.error('Route snapshot function error:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      console.error('Route snapshot generation failed:', data?.error);
      return { success: false, error: data?.error || 'Failed to generate snapshot' };
    }

    console.log('Route snapshot generated:', data.snapshotUrl);
    return { success: true, snapshotUrl: data.snapshotUrl };
  } catch (error) {
    console.error('Error generating route snapshot:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get the current driver location using browser geolocation
 */
export async function getDriverLocation(): Promise<{
  lat: number;
  lng: number;
} | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
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
        console.warn('Geolocation error:', error);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000,
      }
    );
  });
}