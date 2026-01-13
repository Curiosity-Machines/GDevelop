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

// Minimal activity manifest type
interface ActivityManifest {
  projectId: string;
  activityName: string;
  url?: string;
  iconPath?: string;
  bundleUrl?: string;
  webViewResolution?: number;
  version: number;
}

// Database row type
interface Activity {
  id: string;
  name: string;
  url: string | null;
  icon_url: string | null;
  bundle_path: string | null;
  entry_point: string | null;
  webview_resolution: number | null;
  version: number;
}

// Get the download URL for a bundle ZIP file
function getBundleDownloadUrl(bundlePath: string): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  return `${supabaseUrl}/storage/v1/object/public/activity-bundles/${bundlePath}/bundle.zip`;
}

// Convert DB row to manifest format
function dbToManifest(activity: Activity): ActivityManifest {
  const manifest: ActivityManifest = {
    projectId: activity.id,
    activityName: activity.name,
    version: activity.version,
  };

  // Use file:// URL format for bundles, include bundleUrl for download
  if (activity.bundle_path && activity.entry_point) {
    manifest.url = `file://${activity.entry_point}`;
    manifest.bundleUrl = getBundleDownloadUrl(activity.bundle_path);
  } else if (activity.url) {
    manifest.url = activity.url;
  }

  if (activity.icon_url) {
    manifest.iconPath = activity.icon_url;
  }

  // Always include webViewResolution so clients can see the effective value.
  // If not overridden in the DB, default to 1.0 (Vuplex CanvasWebViewPrefab default).
  manifest.webViewResolution = activity.webview_resolution ?? 1.0;

  return manifest;
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
  const prefersHtml = accept.includes('text/html') && !accept.startsWith('application/json');

  // Additional check: common browser user agents
  const browserPatterns = /Mozilla|Chrome|Safari|Firefox|Edge|Opera/i;
  const isBrowserUA = browserPatterns.test(userAgent);

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
    const format = url.searchParams.get('format');

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
      .select('id, name, url, icon_url, bundle_path, entry_point, webview_resolution, version')
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

    // Build manifest
    const manifest = dbToManifest(activity as Activity);

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
