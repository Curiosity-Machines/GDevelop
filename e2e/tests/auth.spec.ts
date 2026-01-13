import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('authenticated user can access gallery', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should be on the gallery page - look for Account button
    await expect(page.getByRole('button', { name: /account/i })).toBeVisible();
  });

  test('Account button is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accountButton = page.getByRole('button', { name: /account/i });
    await expect(accountButton).toBeVisible();
  });

  test('Sign Out button is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const signOutButton = page.getByRole('button', { name: /sign out/i });
    await expect(signOutButton).toBeVisible();
  });

  test('clicking Sign Out returns to login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click sign out
    await page.getByRole('button', { name: /sign out/i }).click();

    // Should show login page
    await expect(page.getByText('Sign in to your account')).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows Your Activities when logged in with activities', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for activities heading or New Activity button
    const hasActivities = await page.getByText('Your Activities').isVisible().catch(() => false);
    const hasNewButton = await page.getByRole('button', { name: /new activity/i }).isVisible().catch(() => false);
    const hasCreateButton = await page.getByRole('button', { name: /create activity/i }).isVisible().catch(() => false);

    expect(hasActivities || hasNewButton || hasCreateButton).toBeTruthy();
  });
});
