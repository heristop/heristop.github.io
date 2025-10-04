import { test } from '@playwright/test';
import { testResponsiveScreenshots, waitForPageLoad, waitForImagesLoad } from '../utils/test-helpers';

test.describe('About Page Visual Tests', () => {
  test('should match about page layout across all devices', async ({ page }) => {
    await testResponsiveScreenshots(page, '/about', 'about');
  });

  test('should display social networks section correctly', async ({ page }) => {
    await page.goto('/about');
    await waitForPageLoad(page);
    await waitForImagesLoad(page);

    // Focus on social networks section
    const socialSection = page.locator('h2:has-text("Social Networks")').locator('..');
    await socialSection.scrollIntoViewIfNeeded();

    await page.screenshot({
      path: 'test-results/about-social-networks.png',
      clip: await socialSection.boundingBox() || undefined,
    });
  });
});