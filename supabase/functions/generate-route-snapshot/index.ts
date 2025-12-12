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

  let body: RouteSnapshotRequest | null = null;

  try {
    // Get the authorization header - required for JWT verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('GOOGLE_MAPS_API_KEY not configured');
      throw new Error('Google Maps API key not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error('Supabase credentials not configured');
      throw new Error('Supabase credentials not configured');
    }

    // Create a client with the user's JWT to verify their identity
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('Failed to get user:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Parse body with error handling
    const rawBody = await req.text();
    console.log('Received raw body:', rawBody);
    
    if (!rawBody || rawBody.trim() === '') {
      throw new Error('Empty request body received');
    }
    
    body = JSON.parse(rawBody) as RouteSnapshotRequest;
    const { orderId, driverLat, driverLng, destinationLat, destinationLng, trackingId } = body;
    
    if (!orderId || driverLat === undefined || driverLng === undefined || destinationLat === undefined || destinationLng === undefined) {
      throw new Error(`Missing required fields. Got: orderId=${orderId}, driverLat=${driverLat}, driverLng=${driverLng}, destLat=${destinationLat}, destLng=${destinationLng}`);
    }

    // Create service role client for privileged operations
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the user is the assigned driver for this order
    const { data: order, error: orderCheckError } = await supabaseClient
      .from('orders')
      .select('assigned_driver_id')
      .eq('id', orderId)
      .single();

    if (orderCheckError || !order) {
      console.error('Order not found:', orderCheckError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.assigned_driver_id !== user.id) {
      console.error('User is not the assigned driver for this order. User:', user.id, 'Assigned:', order.assigned_driver_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - not the assigned driver' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authorized as assigned driver, proceeding with snapshot generation...');
    console.log(`Generating route snapshot for order: ${orderId}`);
    console.log(`Driver start location: ${driverLat}, ${driverLng}`);
    console.log(`Destination: ${destinationLat}, ${destinationLng}`);

    // Set status to PENDING while generating
    await supabaseClient
      .from('orders')
      .update({ delivery_route_snapshot_status: 'PENDING' })
      .eq('id', orderId);

    // First, get the directions to get the encoded polyline
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${driverLat},${driverLng}&destination=${destinationLat},${destinationLng}&key=${GOOGLE_MAPS_API_KEY}`;
    
    console.log('Fetching directions...');
    const directionsResponse = await fetch(directionsUrl);
    const directionsData = await directionsResponse.json();

    if (directionsData.status !== 'OK' || !directionsData.routes?.[0]) {
      console.error('Directions API error:', directionsData.status, directionsData.error_message);
      throw new Error(`Failed to get directions: ${directionsData.status} - ${directionsData.error_message || 'Unknown error'}`);
    }

    // Get the encoded polyline from the route
    const encodedPolyline = directionsData.routes[0].overview_polyline?.points;
    
    if (!encodedPolyline) {
      console.error('No polyline returned from directions');
      throw new Error('No route polyline available');
    }

    console.log('Got route polyline, generating static map...');
    console.log('Polyline length:', encodedPolyline.length);

    // Uber-style muted map styling - high contrast, de-cluttered, route-focused
    // Using URL-encoded style parameters
    const mapStyles = [
      'feature:all|element:geometry|color:0xe8ecef|saturation:-60',
      'feature:all|element:labels.icon|visibility:off',
      'feature:all|element:labels.text.fill|color:0x6b7280',
      'feature:all|element:labels.text.stroke|color:0xffffff|weight:2',
      'feature:administrative|element:labels|visibility:off',
      'feature:administrative.locality|element:labels|visibility:simplified',
      'feature:administrative.neighborhood|visibility:off',
      'feature:poi|visibility:off',
      'feature:poi.business|visibility:off',
      'feature:poi.park|visibility:off',
      'feature:landscape|element:geometry|color:0xe8ecef',
      'feature:landscape.man_made|visibility:off',
      'feature:landscape.natural|element:geometry|color:0xdfe5e8',
      'feature:road.local|element:geometry|color:0xffffff',
      'feature:road.local|element:geometry.stroke|color:0xd1d5db',
      'feature:road.arterial|element:geometry|color:0xf3f4f6',
      'feature:road.arterial|element:geometry.stroke|color:0xc0c4c9',
      'feature:road.highway|element:geometry|color:0xd1d5db',
      'feature:road.highway|element:geometry.stroke|color:0x9ca3af',
      'feature:transit|visibility:off',
      'feature:water|element:geometry|color:0xb8d4e8|saturation:-40',
      'feature:water|element:labels|visibility:off',
    ].map(s => `style=${encodeURIComponent(s)}`).join('&');

    // Start marker - Blue dot (driver start location)
    const startMarker = `markers=color:0x3b82f6|size:mid|${driverLat},${driverLng}`;
    
    // End marker - Black with H label (home/destination) - using custom icon styling
    const endMarker = `markers=color:0x000000|size:mid|label:H|${destinationLat},${destinationLng}`;
    
    // Orange route path - bold, high visibility
    const pathStyle = `path=color:0xF97316FF|weight:6|enc:${encodeURIComponent(encodedPolyline)}`;
    
    // Build final URL - 1280x1280 with scale 2 = 2560x2560 effective (max allowed)
    // Using 640x640 with scale=2 for high DPI (1280x1280 actual pixels)
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=640x640&scale=2&maptype=roadmap&${mapStyles}&${startMarker}&${endMarker}&${pathStyle}&key=${GOOGLE_MAPS_API_KEY}`;

    console.log('Fetching static map image...');
    console.log('Static map URL length:', staticMapUrl.length);
    
    // Fetch the static map image
    const imageResponse = await fetch(staticMapUrl);
    
    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error('Static Maps API error:', imageResponse.status, errorText);
      throw new Error(`Failed to fetch static map: ${imageResponse.status} - ${errorText}`);
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
    } else {
      console.log('Updated orders table with snapshot URL');
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
      } else {
        console.log('Updated public_tracking table with snapshot URL');
      }
    }

    // Update the most recent audit log with snapshot URL
    const { data: auditLogs, error: auditFetchError } = await supabase
      .from('order_audit_logs')
      .select('id')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (auditFetchError) {
      console.error('Error fetching audit logs:', auditFetchError);
    } else if (auditLogs && auditLogs.length > 0) {
      const { error: auditError } = await supabase
        .from('order_audit_logs')
        .update({ delivery_route_snapshot_url: snapshotUrl })
        .eq('id', auditLogs[0].id);

      if (auditError) {
        console.error('Error updating audit log:', auditError);
      } else {
        console.log('Updated audit log with snapshot URL');
      }
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

    // Try to update the order with failed status using the already-parsed body
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && body?.orderId) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('orders')
          .update({
            delivery_route_snapshot_status: 'FAILED',
          })
          .eq('id', body.orderId);
        console.log('Updated order with FAILED status');
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