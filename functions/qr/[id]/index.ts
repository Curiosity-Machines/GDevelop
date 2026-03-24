/**
 * Cloudflare Pages Function: /qr/:id
 *
 * Injects per-activity OG meta tags into the SPA shell before serving it.
 * Crawlers (Slack, iMessage, Twitter) see the tags; browsers get the SPA.
 */
import { fetchActivityMeta } from '../../_shared/config';

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
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

  try {
    const activity = await fetchActivityMeta(id);

    if (activity) {
      const title = `${activity.name} — Dopple Studio`;
      const description =
        activity.description ?? 'Scan to load this activity on your Dopple device.';
      const pageUrl = request.url;
      const siteOrigin = new URL(request.url).origin;
      // Version nonce busts Slack's unfurl cache when the activity is redeployed
      const imageUrl = `${siteOrigin}/qr/${encodeURIComponent(id)}/image?v=${activity.version}`;

      const ogTags = [
        `<meta property="og:type" content="website" />`,
        `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
        `<meta property="og:title" content="${escapeHtml(title)}" />`,
        `<meta property="og:description" content="${escapeHtml(description)}" />`,
        `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
        `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
        `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
      ].join('\n    ');

      html = html
        .replace('<title>Dopple Studio</title>', `<title>${escapeHtml(title)}</title>`)
        .replace('</head>', `    ${ogTags}\n  </head>`);
    }
  } catch {
    // Non-fatal — serve the unmodified SPA shell on any error
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
};
