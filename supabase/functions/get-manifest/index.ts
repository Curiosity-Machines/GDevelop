// Supabase Edge Function: get-manifest
// Returns raw JSON manifest for an activity, accessible via curl
// Browsers are automatically redirected to the web UI manifest page
//
// Usage:
//   curl https://<project>.supabase.co/functions/v1/get-manifest?id=<activity-uuid>
//
// Query params:
//   id     - Activity UUID (required)
//   format - "json" to force JSON response even from browsers (optional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types matching the frontend SerializableActivityData
interface ActivityManifest {
  activityName: string;
  url: string;
  iconPath?: string;
  description?: string;
  activityColor: { r: number; g: number; b: number; a: number };
  requiredLevel: number;
  isLocked: boolean;
  shouldUnlockByLumi: boolean;
  recipeName?: string;
  recipeDescription?: string;
  useDefaultMapping: boolean;
  inputUpdateRate: number;
  departureEmotion?: string;
  arrivalEmotion?: string;
  levelUpMoveSpeed: number;
  enableOnArrival: boolean;
  enableDelay: number;
  playEnableEffect: boolean;
  requiredBubbles: Array<{
    displayName?: string;
    bubbleType: number;
    colorName?: string;
    backgroundColor: { r: number; g: number; b: number; a: number };
    colorTolerance: number;
    useHSVMatching: boolean;
    itemIds: string[];
  }>;
  customInputMappings: Array<{
    mappingName?: string;
    enabled: boolean;
    deviceInput: number;
    keyboardKey: string;
    keyAction: number;
    gyroThreshold: number;
    gyroSensitivity: number;
  }>;
}

// Database row types
interface Activity {
  id: string;
  name: string;
  url: string;
  icon_url: string | null;
  description: string | null;
  color_r: number;
  color_g: number;
  color_b: number;
  color_a: number;
  required_level: number;
  is_locked: boolean;
  should_unlock_by_lumi: boolean;
  recipe_name: string | null;
  recipe_description: string | null;
  use_default_mapping: boolean;
  input_update_rate: number;
  departure_emotion: string | null;
  arrival_emotion: string | null;
  level_up_move_speed: number;
  enable_on_arrival: boolean;
  enable_delay: number;
  play_enable_effect: boolean;
}

interface ActivityBubble {
  display_name: string | null;
  bubble_type: number;
  color_name: string | null;
  bg_color_r: number;
  bg_color_g: number;
  bg_color_b: number;
  bg_color_a: number;
  color_tolerance: number;
  use_hsv_matching: boolean;
  item_ids: string[];
  sort_order: number;
}

interface ActivityInputMapping {
  mapping_name: string | null;
  enabled: boolean;
  device_input: number;
  keyboard_key: string | null;
  key_action: number;
  gyro_threshold: number;
  gyro_sensitivity: number;
  sort_order: number;
}

// Convert DB rows to manifest format
function dbToManifest(
  activity: Activity,
  bubbles: ActivityBubble[],
  mappings: ActivityInputMapping[]
): ActivityManifest {
  return {
    activityName: activity.name,
    url: activity.url,
    iconPath: activity.icon_url ?? undefined,
    description: activity.description ?? undefined,
    activityColor: {
      r: activity.color_r,
      g: activity.color_g,
      b: activity.color_b,
      a: activity.color_a,
    },
    requiredLevel: activity.required_level,
    isLocked: activity.is_locked,
    shouldUnlockByLumi: activity.should_unlock_by_lumi,
    recipeName: activity.recipe_name ?? undefined,
    recipeDescription: activity.recipe_description ?? undefined,
    useDefaultMapping: activity.use_default_mapping,
    inputUpdateRate: activity.input_update_rate,
    departureEmotion: activity.departure_emotion ?? undefined,
    arrivalEmotion: activity.arrival_emotion ?? undefined,
    levelUpMoveSpeed: activity.level_up_move_speed,
    enableOnArrival: activity.enable_on_arrival,
    enableDelay: activity.enable_delay,
    playEnableEffect: activity.play_enable_effect,
    requiredBubbles: bubbles
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((b) => ({
        displayName: b.display_name ?? undefined,
        bubbleType: b.bubble_type,
        colorName: b.color_name ?? undefined,
        backgroundColor: {
          r: b.bg_color_r,
          g: b.bg_color_g,
          b: b.bg_color_b,
          a: b.bg_color_a,
        },
        colorTolerance: b.color_tolerance,
        useHSVMatching: b.use_hsv_matching,
        itemIds: b.item_ids,
      })),
    customInputMappings: mappings
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        mappingName: m.mapping_name ?? undefined,
        enabled: m.enabled,
        deviceInput: m.device_input,
        keyboardKey: m.keyboard_key ?? '',
        keyAction: m.key_action,
        gyroThreshold: m.gyro_threshold,
        gyroSensitivity: m.gyro_sensitivity,
      })),
  };
}

// CORS headers for public access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check if request is from a browser (wants HTML) vs programmatic client (wants JSON)
function isBrowserRequest(req: Request): boolean {
  const accept = req.headers.get('Accept') || '';
  const userAgent = req.headers.get('User-Agent') || '';

  // If Accept header explicitly prefers HTML over JSON, it's likely a browser
  // Browsers typically send: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  // curl sends: "*/*" by default
  const prefersHtml = accept.includes('text/html') && !accept.startsWith('application/json');

  // Additional check: common browser user agents
  const browserPatterns = /Mozilla|Chrome|Safari|Firefox|Edge|Opera/i;
  const isBrowserUA = browserPatterns.test(userAgent);

  // Consider it a browser if Accept prefers HTML AND user agent looks like a browser
  return prefersHtml && isBrowserUA;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get activity ID from URL
    const url = new URL(req.url);
    const activityId = url.searchParams.get('id');
    const format = url.searchParams.get('format'); // Allow explicit format override

    if (!activityId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(activityId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid activity ID format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Redirect browsers to the manifest page unless format=json is specified
    // Use SITE_URL env var for the frontend URL
    if (format !== 'json' && isBrowserRequest(req)) {
      const siteUrl = Deno.env.get('SITE_URL') || 'https://dopple-studio.pages.dev';
      const manifestPageUrl = `${siteUrl}/manifest/${activityId}`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': manifestPageUrl,
        },
      });
    }

    // Create Supabase client with service role for public read access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the activity
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('*')
      .eq('id', activityId)
      .single();

    if (activityError || !activity) {
      return new Response(
        JSON.stringify({ error: 'Activity not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch bubbles
    const { data: bubbles } = await supabase
      .from('activity_bubbles')
      .select('*')
      .eq('activity_id', activityId);

    // Fetch input mappings
    const { data: mappings } = await supabase
      .from('activity_input_mappings')
      .select('*')
      .eq('activity_id', activityId);

    // Build manifest
    const manifest = dbToManifest(
      activity as Activity,
      (bubbles || []) as ActivityBubble[],
      (mappings || []) as ActivityInputMapping[]
    );

    // Return raw JSON
    return new Response(JSON.stringify(manifest, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('Error fetching manifest:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
