import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Step 1: If we have a refresh_token param, show the code page
  const refreshToken = url.searchParams.get("refresh_token");
  if (refreshToken) {
    const code = btoa(refreshToken);
    return new Response(
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dopple CLI Login</title></head>
<body style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:80px auto;text-align:center;padding:0 20px">
  <h2>Paste this code in your terminal</h2>
  <div id="code" style="font-family:monospace;font-size:20px;background:#f0f0f0;padding:16px 24px;border-radius:8px;margin:20px 0;letter-spacing:1px;user-select:all;cursor:pointer;word-break:break-all">dopple:${code}</div>
  <button onclick="navigator.clipboard.writeText(document.getElementById('code').textContent).then(()=>{this.textContent='Copied!';this.style.background='#22c55e';setTimeout(()=>{this.textContent='Copy to clipboard';this.style.background='#2563eb'},2000)})" style="padding:10px 24px;font-size:16px;cursor:pointer;border:none;background:#2563eb;color:white;border-radius:6px">Copy to clipboard</button>
  <p style="margin-top:24px;color:#666">You can close this tab after pasting the code.</p>
</body>
</html>`,
      {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  // Step 2: If we have an access_token in hash (via relay), extract refresh_token
  // Supabase sends tokens as hash fragments, so we need a relay page to convert them
  const accessToken = url.searchParams.get("access_token");
  if (accessToken) {
    // We got tokens as query params (from the relay page), redirect to show code
    const rt = url.searchParams.get("refresh_token");
    if (rt) {
      const code = btoa(rt);
      return new Response(
        `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dopple CLI Login</title></head>
<body style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:80px auto;text-align:center;padding:0 20px">
  <h2>Paste this code in your terminal</h2>
  <div id="code" style="font-family:monospace;font-size:20px;background:#f0f0f0;padding:16px 24px;border-radius:8px;margin:20px 0;letter-spacing:1px;user-select:all;cursor:pointer;word-break:break-all">dopple:${code}</div>
  <button onclick="navigator.clipboard.writeText(document.getElementById('code').textContent).then(()=>{this.textContent='Copied!';this.style.background='#22c55e';setTimeout(()=>{this.textContent='Copy to clipboard';this.style.background='#2563eb'},2000)})" style="padding:10px 24px;font-size:16px;cursor:pointer;border:none;background:#2563eb;color:white;border-radius:6px">Copy to clipboard</button>
  <p style="margin-top:24px;color:#666">You can close this tab after pasting the code.</p>
</body>
</html>`,
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
          },
        }
      );
    }
  }

  // Step 3: No tokens yet. Serve a page that either:
  // a) Has hash fragments (from OAuth redirect) → relay them as query params
  // b) No hash → show login button that starts OAuth
  const functionUrl = `${supabaseUrl}/functions/v1/cli-auth`;

  return new Response(
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dopple CLI Login</title></head>
<body style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:80px auto;text-align:center;padding:0 20px">
  <div id="loading" style="display:none"><h2>Completing login...</h2></div>
  <div id="login">
    <h2>Dopple CLI Login</h2>
    <p style="color:#666;margin-bottom:24px">Sign in to connect your terminal to Dopple Studio.</p>
    <a href="${supabaseUrl}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(functionUrl)}"
       style="padding:12px 32px;font-size:16px;cursor:pointer;border:none;background:#24292f;color:white;border-radius:6px;display:inline-flex;align-items:center;gap:8px;text-decoration:none">
      <svg width="20" height="20" viewBox="0 0 16 16" fill="white"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      Sign in with GitHub
    </a>
  </div>
  <script>
    // If hash has tokens from OAuth redirect, relay them as query params to this same function
    var hash = window.location.hash.substring(1);
    if (hash && hash.indexOf('access_token') !== -1) {
      document.getElementById('login').style.display = 'none';
      document.getElementById('loading').style.display = 'block';
      window.location.replace(window.location.pathname + '?' + hash);
    }
  </script>
</body>
</html>`,
    {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    }
  );
});
