import { test, expect } from '@playwright/test';

test.describe('Gallery View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('displays Dopple header', async ({ page }) => {
    // The page has a "dopple" logo/header
    await expect(page.locator('text=dopple').first()).toBeVisible();
  });

  test('shows Create Activity button or activities', async ({ page }) => {
    // Either shows "Create Activity" (empty state) or "New Activity" (with activities)
    const createButton = page.getByRole('button', { name: /create activity|new activity/i });
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });

  test('shows Account button', async ({ page }) => {
    const accountButton = page.getByRole('button', { name: /account/i });
    await expect(accountButton).toBeVisible();
  });

  test('shows Sign Out button', async ({ page }) => {
    const signOutButton = page.getByRole('button', { name: /sign out/i });
    await expect(signOutButton).toBeVisible();
  });

  test('empty state shows helpful message', async ({ page }) => {
    // If no activities, should show empty state message
    const emptyState = page.getByText(/no activities yet/i);
    const hasActivities = await page.locator('.grid > div').count() > 0;

    if (!hasActivities) {
      await expect(emptyState).toBeVisible();
    }
  });
});
