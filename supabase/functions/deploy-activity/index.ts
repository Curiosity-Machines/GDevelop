// Supabase Edge Function: deploy-activity
// Two-phase activity deployment for the Dopple CLI.
//
// Phase 1 (Initiate): Upserts an activity row and returns signed upload URLs.
//   POST { name, entry_point, has_icon?, icon_extension? }
//
// Phase 2 (Finalize): Validates uploaded bundle and updates the activity record.
//   POST { action: "finalize", activity_id, entry_point, icon_extension? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'activity-bundles';
const MAX_BUNDLE_SIZE = 50 * 1024 * 1024; // 50 MB
const VALID_ICON_EXTENSIONS = new Set([
  'bmp', 'jpg', 'jpeg', 'png', 'psd', 'svg', 'tga', 'tiff', 'tif',
]);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

/** Create a Supabase client scoped to the calling user via their JWT. */
function createUserClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader! } },
  });
}

/** Create a Supabase client with service-role privileges (for storage ops). */
function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceRoleKey);
}

/** Extract user ID from the JWT via supabase auth. */
async function getUserId(userClient: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

// ---------------------------------------------------------------------------
// Phase 1: Initiate
// ---------------------------------------------------------------------------

interface InitiateRequest {
  name: string;
  entry_point: string;
  has_icon?: boolean;
  icon_extension?: string;
}

async function handleInitiate(req: Request, body: InitiateRequest): Promise<Response> {
  // Validate required fields
  if (!body.name || typeof body.name !== 'string') {
    return errorResponse('Missing or invalid field: name', 400);
  }
  if (!body.entry_point || typeof body.entry_point !== 'string') {
    return errorResponse('Missing or invalid field: entry_point', 400);
  }
  if (body.has_icon && body.icon_extension) {
    const ext = body.icon_extension.toLowerCase();
    if (!VALID_ICON_EXTENSIONS.has(ext)) {
      return errorResponse(`Invalid icon_extension: ${ext}. Valid: ${[...VALID_ICON_EXTENSIONS].join(', ')}`, 400);
    }
  }

  const userClient = createUserClient(req);
  const userId = await getUserId(userClient);
  if (!userId) {
    return errorResponse('Invalid auth', 401);
  }

  // Upsert: check for existing activity with same name for this user
  let activityId: string;

  const { data: existing, error: selectError } = await userClient
    .from('activities')
    .select('id')
    .eq('name', body.name)
    .maybeSingle();

  if (selectError) {
    console.error('Error querying activity:', selectError);
    return errorResponse('Server error', 500);
  }

  if (existing) {
    activityId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await userClient
      .from('activities')
      .insert({ name: body.name, user_id: userId })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('Error inserting activity:', insertError);
      return errorResponse('Server error', 500);
    }
    activityId = inserted.id;
  }

  // Generate signed upload URLs via service-role client
  const serviceClient = createServiceClient();
  const bundlePath = `${userId}/${activityId}`;
  const bundleStoragePath = `${bundlePath}/bundle.zip`;

  const { data: bundleUpload, error: bundleUploadError } = await serviceClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(bundleStoragePath, { upsert: true });

  if (bundleUploadError || !bundleUpload) {
    console.error('Error creating bundle upload URL:', bundleUploadError);
    return errorResponse('Server error', 500);
  }

  const result: Record<string, unknown> = {
    activity_id: activityId,
    bundle_upload_url: bundleUpload.signedUrl,
    bundle_upload_token: bundleUpload.token,
    bundle_path: bundlePath,
  };

  // Icon upload URL (if requested)
  if (body.has_icon && body.icon_extension) {
    const ext = body.icon_extension.toLowerCase();
    const iconStoragePath = `${bundlePath}/icon.${ext}`;

    const { data: iconUpload, error: iconUploadError } = await serviceClient.storage
      .from(BUCKET)
      .createSignedUploadUrl(iconStoragePath, { upsert: true });

    if (iconUploadError || !iconUpload) {
      console.error('Error creating icon upload URL:', iconUploadError);
      return errorResponse('Server error', 500);
    }

    result.icon_upload_url = iconUpload.signedUrl;
    result.icon_upload_token = iconUpload.token;
  }

  return jsonResponse(result);
}

// ---------------------------------------------------------------------------
// Phase 2: Finalize
// ---------------------------------------------------------------------------

interface FinalizeRequest {
  action: 'finalize';
  activity_id: string;
  entry_point: string;
  icon_extension?: string;
}

async function handleFinalize(req: Request, body: FinalizeRequest): Promise<Response> {
  // Validate required fields
  if (!body.activity_id || typeof body.activity_id !== 'string') {
    return errorResponse('Missing or invalid field: activity_id', 400);
  }
  if (!body.entry_point || typeof body.entry_point !== 'string') {
    return errorResponse('Missing or invalid field: entry_point', 400);
  }
  if (!body.entry_point.endsWith('.html')) {
    return errorResponse('entry_point must have .html extension', 400);
  }

  const userClient = createUserClient(req);
  const userId = await getUserId(userClient);
  if (!userId) {
    return errorResponse('Invalid auth', 401);
  }

  // Verify activity exists and belongs to user (RLS enforces ownership)
  const { data: activity, error: activityError } = await userClient
    .from('activities')
    .select('id, name, version')
    .eq('id', body.activity_id)
    .single();

  if (activityError || !activity) {
    return errorResponse('Activity not found', 404);
  }

  // Download and validate the uploaded bundle
  const serviceClient = createServiceClient();
  const bundlePath = `${userId}/${activity.id}`;
  const bundleStoragePath = `${bundlePath}/bundle.zip`;

  const { data: bundleData, error: downloadError } = await serviceClient.storage
    .from(BUCKET)
    .download(bundleStoragePath);

  if (downloadError || !bundleData) {
    console.error('Error downloading bundle:', downloadError);
    return errorResponse('Bundle not found. Upload the bundle before finalizing.', 404);
  }

  // Validate bundle size
  if (bundleData.size > MAX_BUNDLE_SIZE) {
    return errorResponse(`Bundle too large: ${bundleData.size} bytes (max ${MAX_BUNDLE_SIZE})`, 413);
  }

  // Validate ZIP magic bytes (PK\x03\x04)
  const header = new Uint8Array(await bundleData.slice(0, 4).arrayBuffer());
  if (header[0] !== 0x50 || header[1] !== 0x4B || header[2] !== 0x03 || header[3] !== 0x04) {
    return errorResponse('Invalid bundle: not a valid ZIP file', 400);
  }

  // Build icon URL if icon was uploaded
  let iconUrl: string | null = null;
  if (body.icon_extension) {
    const ext = body.icon_extension.toLowerCase();
    if (!VALID_ICON_EXTENSIONS.has(ext)) {
      return errorResponse(`Invalid icon_extension: ${ext}`, 400);
    }

    const iconStoragePath = `${bundlePath}/icon.${ext}`;
    const { data: iconExists } = await serviceClient.storage
      .from(BUCKET)
      .download(iconStoragePath);

    if (iconExists) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      iconUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${iconStoragePath}`;
    }
  }

  // Update activity record (triggers auto-increment version and updated_at)
  const { data: updated, error: updateError } = await userClient
    .from('activities')
    .update({
      bundle_path: bundlePath,
      entry_point: body.entry_point,
      icon_url: iconUrl,
    })
    .eq('id', activity.id)
    .select('id, name, version')
    .single();

  if (updateError || !updated) {
    console.error('Error updating activity:', updateError);
    return errorResponse('Server error', 500);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://dopple-studio.pages.dev';

  return jsonResponse({
    id: updated.id,
    name: updated.name,
    version: updated.version,
    manifest_url: `${supabaseUrl}/functions/v1/get-manifest?id=${updated.id}`,
    qr_url: `${siteUrl}/qr/${updated.id}`,
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body = await req.json();

    if (body.action === 'finalize') {
      return await handleFinalize(req, body as FinalizeRequest);
    } else {
      return await handleInitiate(req, body as InitiateRequest);
    }
  } catch (error) {
    console.error('Unhandled error:', error);
    return errorResponse('Server error', 500);
  }
});
