import { test } from '@playwright/test';
import { testResponsiveScreenshots } from '../utils/test-helpers';

test.describe('Blog Page Visual Tests', () => {
  test('should match blog listing layout across all devices', async ({ page }) => {
    await testResponsiveScreenshots(page, '/blog', 'blog-listing');
  });

  test('should match blog post layout across all devices', async ({ page }) => {
    // Navigate to a recent blog post
    await page.goto('/blog');

    // Wait for the page to load and click on the first blog post link
    await page.waitForLoadState('networkidle');
    const firstPostLink = page.locator('a[href*="/blog/"]').first();

    if (await firstPostLink.count() > 0) {
      const href = await firstPostLink.getAttribute('href');
      if (href) {
        await testResponsiveScreenshots(page, href, 'blog-post');
      }
    }
  });
});