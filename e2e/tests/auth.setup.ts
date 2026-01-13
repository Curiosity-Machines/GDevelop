import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

/**
 * Authentication setup - runs once before all tests
 * Authenticates via Supabase API and injects the session into the browser
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are required'
    );
  }

  // First, navigate to the app to get the Supabase URL from the page
  await page.goto('/');

  // Wait for the login form to appear (to ensure page is loaded)
  await expect(page.getByText('Sign in to your account')).toBeVisible();

  // Supabase configuration - read from env or use defaults
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL || 'https://onljswkegixyjjhpcldn.supabase.co';
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubGpzd2tlZ2l4eWpqaHBjbGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDY1MzEsImV4cCI6MjA4MTEyMjUzMX0.MtOk_dTmjvSduX2AW4YzmSwxaACua3B5z3O8gBRPG7k';

  // Authenticate via the Supabase API directly and inject the session
  const authResult = await page.evaluate(
    async ({ email, password, supabaseUrl, supabaseAnonKey }) => {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { error: error.error_description || error.message || 'Login failed' };
      }

      const data = await response.json();

      // Extract project ref from URL for storage key
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] || 'unknown';

      // Store the session in localStorage (how Supabase JS client stores it)
      const storageKey = `sb-${projectRef}-auth-token`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
          expires_in: data.expires_in,
          token_type: data.token_type,
          user: data.user,
        })
      );

      return { success: true, email: data.user?.email };
    },
    { email, password, supabaseUrl, supabaseAnonKey }
  );

  if ('error' in authResult) {
    throw new Error(`Login failed: ${authResult.error}`);
  }

  console.log(`Authenticated as: ${authResult.email}`);

  // Navigate to the home page to pick up the session
  await page.goto('/');

  // Wait for network to settle
  await page.waitForLoadState('networkidle');

  // Wait a bit for auth state to initialize
  await page.waitForTimeout(2000);

  // Check current URL
  const url = page.url();
  console.log(`Current URL: ${url}`);

  // Look for gallery content - check for Account button (indicates we're logged in)
  await expect(page.getByRole('button', { name: 'Account' })).toBeVisible({ timeout: 10000 });

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});
