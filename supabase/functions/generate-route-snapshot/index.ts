import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RouteSnapshotRequest {
  orderId: string;
  driverLat: number;
  driverLng: number;
  destinationLat: number;
  destinationLng: number;
  trackingId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('GOOGLE_MAPS_API_KEY not configured');
      throw new Error('Google Maps API key not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase credentials not configured');
      throw new Error('Supabase credentials not configured');
    }

    const body: RouteSnapshotRequest = await req.json();
    const { orderId, driverLat, driverLng, destinationLat, destinationLng, trackingId } = body;

    console.log(`Generating route snapshot for order: ${orderId}`);
    console.log(`Driver location: ${driverLat}, ${driverLng}`);
    console.log(`Destination: ${destinationLat}, ${destinationLng}`);

    // First, get the directions to get the encoded polyline
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${driverLat},${driverLng}&destination=${destinationLat},${destinationLng}&key=${GOOGLE_MAPS_API_KEY}`;
    
    console.log('Fetching directions...');
    const directionsResponse = await fetch(directionsUrl);
    const directionsData = await directionsResponse.json();

    if (directionsData.status !== 'OK' || !directionsData.routes?.[0]) {
      console.error('Directions API error:', directionsData.status);
      throw new Error(`Failed to get directions: ${directionsData.status}`);
    }

    // Get the encoded polyline from the route
    const encodedPolyline = directionsData.routes[0].overview_polyline?.points;
    
    if (!encodedPolyline) {
      console.error('No polyline returned from directions');
      throw new Error('No route polyline available');
    }

    console.log('Got route polyline, generating static map...');

    // Build the Static Maps API URL
    // Muted, decluttered map style (similar to Waze/Uber)
    const mapStyle = [
      'feature:all|element:geometry|color:0xf0f0f0',
      'feature:all|element:labels.text.fill|color:0x6b6b6b',
      'feature:all|element:labels.text.stroke|color:0xffffff',
      'feature:road.highway|element:geometry|color:0xdedede',
      'feature:road.arterial|element:geometry|color:0xe0e0e0',
      'feature:road.local|element:geometry|color:0xeeeeee',
      'feature:poi|visibility:off',
      'feature:transit|visibility:off',
      'feature:administrative.neighborhood|visibility:off',
    ].map(s => `style=${encodeURIComponent(s)}`).join('&');

    // Markers: Start (blue) and End (black with home icon)
    const startMarker = `markers=color:blue|size:small|${driverLat},${driverLng}`;
    const endMarker = `markers=color:black|label:H|${destinationLat},${destinationLng}`;
    
    // Orange route path
    const pathStyle = `path=color:0xF97316|weight:5|enc:${encodedPolyline}`;
    
    // Build final URL
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=640x400&scale=2&maptype=roadmap&${mapStyle}&${startMarker}&${endMarker}&${pathStyle}&key=${GOOGLE_MAPS_API_KEY}`;

    console.log('Fetching static map image...');
    
    // Fetch the static map image
    const imageResponse = await fetch(staticMapUrl);
    
    if (!imageResponse.ok) {
      console.error('Static Maps API error:', imageResponse.status);
      throw new Error(`Failed to fetch static map: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);

    console.log(`Got static map image: ${imageBytes.length} bytes`);

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `route-${orderId}-${timestamp}.png`;

    console.log(`Uploading to storage: ${filename}`);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('route-snapshots')
      .upload(filename, imageBytes, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload snapshot: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('route-snapshots')
      .getPublicUrl(filename);

    const snapshotUrl = urlData.publicUrl;
    console.log(`Snapshot uploaded: ${snapshotUrl}`);

    // Update orders table
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        delivery_route_snapshot_url: snapshotUrl,
        delivery_route_snapshot_status: 'COMPLETED',
      })
      .eq('id', orderId);

    if (orderError) {
      console.error('Error updating orders:', orderError);
    }

    // Update public_tracking table
    if (trackingId) {
      const { error: trackingError } = await supabase
        .from('public_tracking')
        .update({
          delivery_route_snapshot_url: snapshotUrl,
          delivery_route_snapshot_status: 'COMPLETED',
        })
        .eq('tracking_id', trackingId);

      if (trackingError) {
        console.error('Error updating public_tracking:', trackingError);
      }
    }

    // Update audit log with snapshot URL
    const { error: auditError } = await supabase
      .from('order_audit_logs')
      .update({
        delivery_route_snapshot_url: snapshotUrl,
      })
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (auditError) {
      console.error('Error updating audit log:', auditError);
    }

    console.log('Route snapshot generation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        snapshotUrl,
        message: 'Route snapshot generated successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Route snapshot error:', error);

    // Try to update the order with failed status
    try {
      const body = await req.clone().json();
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && body.orderId) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('orders')
          .update({
            delivery_route_snapshot_status: 'FAILED',
          })
          .eq('id', body.orderId);
      }
    } catch (e) {
      console.error('Failed to update failure status:', e);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});