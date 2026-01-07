import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Define geo zones based on regions in Canada
const GEO_ZONES: Record<string, string[]> = {
  'GTA': ['Toronto', 'Scarborough', 'North York', 'Etobicoke', 'East York', 'York', 'Mississauga', 'Brampton', 'Markham', 'Vaughan', 'Richmond Hill', 'Oakville', 'Burlington', 'Milton', 'Ajax', 'Pickering', 'Whitby', 'Oshawa'],
  'OTTAWA': ['Ottawa', 'Gatineau', 'Kanata', 'Orleans', 'Nepean', 'Gloucester'],
  'HAMILTON': ['Hamilton', 'Dundas', 'Ancaster', 'Stoney Creek', 'Burlington'],
  'LONDON': ['London', 'St. Thomas', 'Woodstock', 'Stratford'],
  'WINDSOR': ['Windsor', 'LaSalle', 'Tecumseh', 'Lakeshore', 'Amherstburg'],
  'KITCHENER': ['Kitchener', 'Waterloo', 'Cambridge', 'Guelph'],
  'NIAGARA': ['St. Catharines', 'Niagara Falls', 'Welland', 'Fort Erie', 'Grimsby'],
  'BARRIE': ['Barrie', 'Orillia', 'Innisfil', 'Collingwood'],
  'KINGSTON': ['Kingston', 'Belleville', 'Brockville', 'Cornwall'],
  'SUDBURY': ['Sudbury', 'North Bay', 'Timmins', 'Sault Ste. Marie'],
  'THUNDER BAY': ['Thunder Bay', 'Kenora', 'Dryden'],
  'VANCOUVER': ['Vancouver', 'Burnaby', 'Surrey', 'Richmond', 'Coquitlam', 'North Vancouver', 'West Vancouver', 'New Westminster', 'Delta', 'Langley', 'Abbotsford'],
  'CALGARY': ['Calgary', 'Airdrie', 'Cochrane', 'Okotoks', 'Chestermere'],
  'EDMONTON': ['Edmonton', 'St. Albert', 'Sherwood Park', 'Spruce Grove', 'Leduc'],
  'WINNIPEG': ['Winnipeg', 'Brandon', 'Steinbach'],
  'MONTREAL': ['Montreal', 'Laval', 'Longueuil', 'Brossard', 'Terrebonne', 'Blainville'],
  'QUEBEC CITY': ['Quebec City', 'Lévis', 'Beauport'],
  'HALIFAX': ['Halifax', 'Dartmouth', 'Bedford'],
  'VICTORIA': ['Victoria', 'Saanich', 'Langford', 'Nanaimo'],
};

function determineGeoZone(city: string | null, province: string | null): string {
  if (!city) return 'UNKNOWN';
  
  const cityLower = city.toLowerCase();
  
  for (const [zone, cities] of Object.entries(GEO_ZONES)) {
    if (cities.some(c => cityLower.includes(c.toLowerCase()) || c.toLowerCase().includes(cityLower))) {
      return zone;
    }
  }
  
  // If no zone matched, use province abbreviation or UNKNOWN
  if (province) {
    const provinceLower = province.toLowerCase();
    if (provinceLower.includes('ontario') || provinceLower === 'on') return 'ONTARIO';
    if (provinceLower.includes('british columbia') || provinceLower === 'bc') return 'BC';
    if (provinceLower.includes('alberta') || provinceLower === 'ab') return 'ALBERTA';
    if (provinceLower.includes('quebec') || provinceLower === 'qc') return 'QUEBEC';
    if (provinceLower.includes('manitoba') || provinceLower === 'mb') return 'MANITOBA';
    if (provinceLower.includes('saskatchewan') || provinceLower === 'sk') return 'SASKATCHEWAN';
    if (provinceLower.includes('nova scotia') || provinceLower === 'ns') return 'NOVA_SCOTIA';
    if (provinceLower.includes('new brunswick') || provinceLower === 'nb') return 'NEW_BRUNSWICK';
    if (provinceLower.includes('newfoundland') || provinceLower === 'nl') return 'NEWFOUNDLAND';
    if (provinceLower.includes('prince edward') || provinceLower === 'pe') return 'PEI';
  }
  
  return 'UNKNOWN';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    
    if (!apiKey) {
      console.error("GOOGLE_MAPS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { address } = await req.json();
    
    if (!address) {
      return new Response(
        JSON.stringify({ error: "Address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Geocoding address:", address);

    // Use Google Maps Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    console.log("Geocode response status:", data.status);

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.error("Geocoding failed:", data.status, data.error_message);
      return new Response(
        JSON.stringify({ 
          error: "Geocoding failed", 
          status: data.status,
          message: data.error_message 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = data.results[0];
    const location = result.geometry.location;
    
    // Extract city and province from address components
    let city: string | null = null;
    let province: string | null = null;
    let country: string | null = null;
    
    for (const component of result.address_components) {
      if (component.types.includes('locality')) {
        city = component.long_name;
      } else if (component.types.includes('sublocality_level_1') && !city) {
        city = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        province = component.short_name;
      } else if (component.types.includes('country')) {
        country = component.long_name;
      }
    }

    const geoZone = determineGeoZone(city, province);

    console.log("Geocoded successfully:", { lat: location.lat, lng: location.lng, city, province, geoZone });

    return new Response(
      JSON.stringify({
        latitude: location.lat,
        longitude: location.lng,
        city,
        province,
        country: country || 'Canada',
        geo_zone: geoZone,
        formatted_address: result.formatted_address
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error geocoding address:", error);
    return new Response(
      JSON.stringify({ error: "Failed to geocode address", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
