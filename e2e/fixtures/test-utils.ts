import { Page, expect } from '@playwright/test';

/**
 * Wait for the gallery page to fully load
 */
export async function waitForGalleryLoad(page: Page) {
  await expect(page.getByRole('heading', { name: /activities/i })).toBeVisible();
}

/**
 * Get the count of activity cards displayed in the gallery
 */
export async function getActivityCardCount(page: Page): Promise<number> {
  const cards = page.locator('[data-testid="activity-card"]');
  // Fallback to counting by class if no test ids
  const count = await cards.count();
  if (count > 0) return count;

  // Alternative: count cards by their visual structure
  const cardsByStructure = page.locator('.bg-white.rounded-lg.shadow');
  return cardsByStructure.count();
}

/**
 * Click the edit button for a specific activity by name
 */
export async function openActivityEditor(page: Page, activityName: string) {
  const activityCard = page.locator(`text=${activityName}`).first();
  await activityCard.click();
}

/**
 * Navigate to manifest page for an activity
 */
export async function navigateToManifest(page: Page, activityId: string) {
  await page.goto(`/manifest/${activityId}`);
  await expect(page.getByText(/activity manifest/i)).toBeVisible();
}

/**
 * Copy QR link and return the copied URL
 */
export async function copyQRLink(page: Page): Promise<string> {
  // Grant clipboard permissions
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  // Click copy link button
  await page.getByRole('button', { name: /copy.*link/i }).click();

  // Read from clipboard
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  return clipboardText;
}

/**
 * Open the account settings modal
 */
export async function openAccountSettings(page: Page) {
  await page.getByRole('button', { name: /account/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * Close any open modal
 */
export async function closeModal(page: Page) {
  // Try clicking a close button or cancel
  const closeButton = page.getByRole('button', { name: /close|cancel/i });
  if (await closeButton.isVisible()) {
    await closeButton.click();
  } else {
    // Press Escape as fallback
    await page.keyboard.press('Escape');
  }
}
