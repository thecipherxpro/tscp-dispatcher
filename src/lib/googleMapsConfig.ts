// Google Maps configuration helper
let googleMapsApiKey: string | null = null;

export function setGoogleMapsOptions(options: { key: string }) {
  googleMapsApiKey = options.key;
  
  // Set the API key for Google Maps loader
  if (typeof window !== 'undefined' && !document.querySelector('script[src*="maps.googleapis.com"]')) {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${options.key}&libraries=places,marker&v=weekly`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }
}

export function getGoogleMapsApiKey() {
  return googleMapsApiKey;
}
