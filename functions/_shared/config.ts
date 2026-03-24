// Supabase public values — same as baked into the CLI defaults.
export const SUPABASE_URL = 'https://onljswkegixyjjhpcldn.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubGpzd2tlZ2l4eWpqaHBjbGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDY1MzEsImV4cCI6MjA4MTEyMjUzMX0.MtOk_dTmjvSduX2AW4YzmSwxaACua3B5z3O8gBRPG7k';

// The canonical URL that all QR codes encode — no format param.
// Devices scan this; the edge function handles redirect vs JSON via Accept header.
export function getManifestUrl(activityId: string): string {
  return `${SUPABASE_URL}/functions/v1/get-manifest?id=${activityId}`;
}

export interface ActivityMeta {
  name: string;
  description: string | null;
  icon_url: string | null;
  version: number;
}

export async function fetchActivityMeta(id: string): Promise<ActivityMeta | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/activities?id=eq.${encodeURIComponent(id)}&select=name,description,icon_url,version&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  if (!res.ok) return null;
  const rows: ActivityMeta[] = await res.json();
  return rows[0] ?? null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUUID(id: string): boolean {
  return UUID_RE.test(id);
}
