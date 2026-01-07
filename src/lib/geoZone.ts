export type GeoZone = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

// Toronto city center coordinates (used as reference point for zone classification)
const CITY_CENTER_LAT = 43.6532;
const CITY_CENTER_LNG = -79.3832;

/**
 * Determine a single cardinal zone for a coordinate.
 *
 * Rule: whichever axis deviates more from the city center wins.
 * - Larger north/south deviation => NORTH or SOUTH
 * - Larger east/west deviation => EAST or WEST
 */
export function determineGeoZone(lat: number, lng: number): GeoZone {
  const dLat = lat - CITY_CENTER_LAT;
  const dLng = lng - CITY_CENTER_LNG;

  if (Math.abs(dLat) >= Math.abs(dLng)) {
    return dLat >= 0 ? 'NORTH' : 'SOUTH';
  }

  return dLng >= 0 ? 'EAST' : 'WEST';
}

export function normalizeGeoZone(value: string | null | undefined): GeoZone | null {
  const v = (value || '').toUpperCase();
  if (v === 'NORTH' || v === 'SOUTH' || v === 'EAST' || v === 'WEST') return v;
  return null;
}

export function getOrderGeoZone(order: {
  latitude: number | null;
  longitude: number | null;
  geo_zone?: string | null;
}): GeoZone | null {
  const normalized = normalizeGeoZone(order.geo_zone);
  if (normalized) return normalized;

  if (order.latitude == null || order.longitude == null) return null;
  return determineGeoZone(order.latitude, order.longitude);
}
