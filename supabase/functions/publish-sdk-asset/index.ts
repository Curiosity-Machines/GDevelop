// Supabase Edge Function: publish-sdk-asset
// Admin-gated endpoint that returns signed upload URLs for the sdk-assets bucket.
//
// Usage:
//   POST { files: ["dopple-cli.cjs", "dopple-deploy.md"] }
//   Returns: { uploads: [{ file: "...", signed_url: "...", token: "..." }, ...] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'sdk-assets';
const SIGNED_URL_EXPIRY = 3600; // 1 hour

// Admin user IDs — only these users can publish SDK assets
const ADMIN_USER_IDS = new Set([
  'ee506c84-4ba5-4bf1-818f-b2d8f2f7edf4', // michael@dopple.com
  'b27f1414-b63f-45dd-9a63-51ab255a9cea', // amir@dopple.com
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Authenticate user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return errorResponse('Missing authorization', 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return errorResponse('Invalid auth', 401);
    }

    // Check admin privilege
    if (!ADMIN_USER_IDS.has(user.id)) {
      return errorResponse('Insufficient privileges', 403);
    }

    // Parse request
    const body = await req.json();
    const files = body.files as string[];

    if (!Array.isArray(files) || files.length === 0) {
      return errorResponse('Missing or empty files array', 400);
    }

    // Generate signed upload URLs via service role
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const uploads: { file: string; signed_url: string; token: string }[] = [];

    for (const file of files) {
      if (typeof file !== 'string' || file.includes('..') || file.startsWith('/')) {
        return errorResponse(`Invalid filename: ${file}`, 400);
      }

      const { data, error } = await serviceClient.storage
        .from(BUCKET)
        .createSignedUploadUrl(file, { upsert: true });

      if (error || !data) {
        console.error(`Failed to create upload URL for ${file}:`, error);
        return errorResponse(`Failed to create upload URL for ${file}`, 500);
      }

      uploads.push({
        file,
        signed_url: data.signedUrl,
        token: data.token,
      });
    }

    return jsonResponse({ uploads });
  } catch (error) {
    console.error('Unhandled error:', error);
    return errorResponse('Server error', 500);
  }
});
