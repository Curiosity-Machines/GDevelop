/**
 * Cloudflare Pages Function: /qr/:id
 *
 * Injects per-activity OG meta tags into the SPA shell before serving it.
 * This makes the QR page URL unfurl correctly in Slack, iMessage, etc. —
 * showing the activity name, description, and QR image preview instead of
 * the generic "Dopple Studio" fallback.
 */

interface Env {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

interface Activity {
  name: string;
  description: string | null;
  icon_url: string | null;
  bundle_path: string | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };
  const { env, request } = context;

  // Serve the SPA shell (index.html)
  const spaRequest = new Request(new URL('/', request.url).toString(), request);
  const spaResponse = await env.ASSETS.fetch(spaRequest);
  let html = await spaResponse.text();

  // Attempt to fetch activity metadata for OG injection
  try {
    const res = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/activities?id=eq.${encodeURIComponent(id)}&select=name,description,icon_url,bundle_path&limit=1`,
      {
        headers: {
          apikey: env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (res.ok) {
      const rows: Activity[] = await res.json();
      const activity = rows[0];

      if (activity) {
        const title = `${activity.name} — Dopple Studio`;
        const description =
          activity.description ?? 'Scan to load this activity on your Dopple device.';
        const pageUrl = request.url;
        const imageUrl = activity.bundle_path
          ? `${env.VITE_SUPABASE_URL}/storage/v1/object/public/activity-bundles/${activity.bundle_path}/qr.png`
          : null;

        const ogTags = [
          `<meta property="og:type" content="website" />`,
          `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
          `<meta property="og:title" content="${escapeHtml(title)}" />`,
          `<meta property="og:description" content="${escapeHtml(description)}" />`,
          imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : '',
          `<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />`,
          `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
          `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
          imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : '',
        ]
          .filter(Boolean)
          .join('\n    ');

        html = html
          .replace('<title>Dopple Studio</title>', `<title>${escapeHtml(title)}</title>`)
          .replace('</head>', `    ${ogTags}\n  </head>`);
      }
    }
  } catch {
    // Non-fatal — serve the unmodified SPA shell on any error
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      // Short cache: activity name/description can change after a redeploy
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
};
