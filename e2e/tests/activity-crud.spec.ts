import { test, expect } from '@playwright/test';

test.describe('Activity CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Create Activity', () => {
    test('opens activity form', async ({ page }) => {
      // Click create/new activity button
      const createButton = page.getByRole('button', { name: /create activity|new activity/i });
      await createButton.click();

      // Should show form with name input
      await expect(page.getByLabel(/name/i)).toBeVisible({ timeout: 5000 });
    });

    test('can create activity with Web URL', async ({ page }) => {
      // Click create button
      const createButton = page.getByRole('button', { name: /create activity|new activity/i });
      await createButton.click();

      // Wait for form
      await expect(page.getByLabel(/name/i)).toBeVisible({ timeout: 5000 });

      // Fill in activity details
      const testName = `E2E Test ${Date.now()}`;
      await page.getByLabel(/name/i).fill(testName);

      // Fill URL if visible
      const urlInput = page.getByLabel(/url/i);
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com');
      }

      // Save the activity
      await page.getByRole('button', { name: /save|create/i }).first().click();

      // Should show the new activity or return to gallery
      await page.waitForTimeout(2000);
      await expect(page.getByText(testName)).toBeVisible({ timeout: 10000 });
    });

    test('form has cancel option', async ({ page }) => {
      // Click create button
      const createButton = page.getByRole('button', { name: /create activity|new activity/i });
      await createButton.click();

      // Wait for form
      await expect(page.getByLabel(/name/i)).toBeVisible({ timeout: 5000 });

      // Look for cancel button
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await expect(cancelButton).toBeVisible();
    });
  });

  test.describe('Edit Activity', () => {
    // These tests require an existing activity
    test.beforeEach(async ({ page }) => {
      // First create an activity if none exist
      const emptyState = page.getByText(/no activities yet/i);
      if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
        const createButton = page.getByRole('button', { name: /create activity/i });
        await createButton.click();
        await page.getByLabel(/name/i).fill(`Test Activity ${Date.now()}`);
        const urlInput = page.getByLabel(/url/i);
        if (await urlInput.isVisible()) {
          await urlInput.fill('https://example.com');
        }
        await page.getByRole('button', { name: /save|create/i }).first().click();
        await page.waitForTimeout(2000);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
      }
    });

    test('can click Edit on activity', async ({ page }) => {
      // Look for Edit buttons (each activity card has one)
      const editButtons = page.getByRole('button', { name: 'Edit' });

      if ((await editButtons.count()) > 0) {
        // Click the first Edit button
        await editButtons.first().click();

        // Should show form with name input
        await expect(page.getByLabel(/name/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
