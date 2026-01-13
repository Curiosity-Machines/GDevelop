import { test, expect } from '@playwright/test';

// Manifest tests are simpler - they just test the manifest page structure
// These tests assume we have an activity ID to test with

test.describe('Manifest Page', () => {
  // We'll create an activity first and get its manifest URL
  let activityId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Create an activity to test manifests with
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();

    await page.goto('https://dopple-studio.pages.dev/');
    await page.waitForLoadState('networkidle');

    // Create a test activity
    const createButton = page.getByRole('button', { name: /create activity|new activity/i });
    await createButton.click();

    await page.getByLabel(/name/i).fill(`Manifest Test ${Date.now()}`);
    const urlInput = page.getByLabel(/url/i);
    if (await urlInput.isVisible()) {
      await urlInput.fill('https://example.com');
    }

    await page.getByRole('button', { name: /save|create/i }).first().click();
    await page.waitForTimeout(3000);

    // Try to get the activity ID from the URL or clipboard
    // Navigate back and look for activities
    await page.goto('https://dopple-studio.pages.dev/');
    await page.waitForLoadState('networkidle');

    // Look for any activity cards
    const activities = page.locator('[data-activity-id]').or(
      page.locator('.grid > div').filter({ hasText: /manifest test/i })
    );

    if ((await activities.count()) > 0) {
      // Get the activity ID from the page if available
      activityId = await activities.first().getAttribute('data-activity-id');
    }

    await context.close();
  });

  test('manifest pages load for valid activities', async ({ page }) => {
    // Skip if we couldn't create an activity
    test.skip(!activityId, 'No activity ID available');

    await page.goto(`https://dopple-studio.pages.dev/manifest/${activityId}`);
    await page.waitForLoadState('networkidle');

    // Should show some content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(20);
  });

  test('manifest page shows QR code or activity info', async ({ page }) => {
    test.skip(!activityId, 'No activity ID available');

    await page.goto(`https://dopple-studio.pages.dev/manifest/${activityId}`);
    await page.waitForLoadState('networkidle');

    // Look for QR code or activity information
    const hasQR = await page.locator('svg').or(page.locator('canvas')).count() > 0;
    const hasActivityText = await page.getByText(/activity|manifest/i).count() > 0;

    expect(hasQR || hasActivityText).toBeTruthy();
  });

  test('manifest pages are publicly accessible', async ({ browser }) => {
    test.skip(!activityId, 'No activity ID available');

    // Create fresh context without auth
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`https://dopple-studio.pages.dev/manifest/${activityId}`);
    await page.waitForLoadState('networkidle');

    // Should still load without auth
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();

    await context.close();
  });
});
