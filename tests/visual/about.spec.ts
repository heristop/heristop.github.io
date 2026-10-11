import { test } from '@playwright/test';
import { testResponsiveScreenshots, waitForImagesLoad, waitForPageLoad } from '../utils/test-helpers';

test.describe('About Page Visual Tests', () => {
  test('should match about page layout across all devices', async ({ page }) => {
    await testResponsiveScreenshots(page, '/about', 'about');
  });

  test('should display the Elsewhere links correctly', async ({ page }) => {
    await page.goto('/about');
    await waitForPageLoad(page);
    await waitForImagesLoad(page);

    // Focus on the Elsewhere section
    const socialSection = page.locator('section[aria-labelledby="about-elsewhere-heading"]');
    await socialSection.scrollIntoViewIfNeeded();

    await page.screenshot({
      clip: await socialSection.boundingBox() || undefined,
      path: 'test-results/about-elsewhere.png',
    });
  });
});