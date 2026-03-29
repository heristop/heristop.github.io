import { test } from '@playwright/test';
import { testResponsiveScreenshots, waitForImagesLoad, waitForPageLoad } from '../utils/test-helpers';

test.describe('Projects Page Visual Tests', () => {
  test('should match projects page layout across all devices', async ({ page }) => {
    await testResponsiveScreenshots(page, '/projects', 'projects');
  });

  test('should display project grid correctly', async ({ page }) => {
    await page.goto('/projects');
    await waitForPageLoad(page);
    await waitForImagesLoad(page);

    // Focus on the main project grid
    const projectGrid = page.locator('main').first();
    await projectGrid.scrollIntoViewIfNeeded();

    await page.screenshot({
      clip: await projectGrid.boundingBox() || undefined,
      path: 'test-results/projects-grid.png',
    });
  });
});