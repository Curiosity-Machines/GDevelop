const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function codePage(code: string): Response {
  return new Response(
    `Dopple CLI Login\n\nPaste this code in your terminal:\n\n${code}\n\nYou can close this tab after pasting.\n`,
    {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const functionUrl = `${supabaseUrl}/functions/v1/cli-auth`;

  // Step 2: After OAuth, Supabase redirects here with ?code=...
  // Exchange the code for tokens using the PKCE verifier from the cookie
  const code = url.searchParams.get("code");
  if (code) {
    // Read the PKCE verifier from cookie
    const cookies = req.headers.get("cookie") || "";
    const match = cookies.match(/pkce_verifier=([^;]+)/);
    const verifier = match ? match[1] : null;

    if (!verifier) {
      return new Response("Missing PKCE verifier. Please try logging in again.", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // Exchange authorization code for tokens
    const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({
        auth_code: code,
        code_verifier: verifier,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return new Response(`Token exchange failed: ${err}`, {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const tokens = await tokenRes.json();
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return new Response("No refresh token received.", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const doppleCode = btoa(refreshToken);

    // Clear the cookie and show the code
    return codePage(doppleCode);
  }

  // Step 1: No code yet — generate PKCE challenge and redirect to OAuth
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  const authUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
  authUrl.searchParams.set("provider", "github");
  authUrl.searchParams.set("redirect_to", functionUrl);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("flow_type", "pkce");

  // Store verifier in a cookie, redirect to OAuth
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      "Location": authUrl.toString(),
      "Set-Cookie": `pkce_verifier=${verifier}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
    },
  });
});
