import { test } from '@playwright/test';
import { testResponsiveScreenshots } from '../utils/test-helpers';

test.describe('Homepage Visual Tests', () => {
  test('should match homepage layout across all devices', async ({ page }) => {
    await testResponsiveScreenshots(page, '/', 'homepage');
  });
});