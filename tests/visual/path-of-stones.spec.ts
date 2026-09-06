import { expect, test } from '@playwright/test';
import { waitForImagesLoad, waitForPageLoad } from '../utils/test-helpers';

// The garden is generated from a committed seed, so this snapshot is stable until the
// seed or the art changes — both of which are deliberate, reviewable commits.
test.describe('Path of Stones visual tests', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile === undefined,
    'snapshots are pinned to chromium to keep the snapshot count manageable',
  );

  test('matches the garden layout', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/path-of-stones');
    await waitForPageLoad(page);
    await waitForImagesLoad(page);
    const map = page.getByRole('application', { name: /game world map/i });
    await expect(map).toHaveScreenshot('path-garden.png', { maxDiffPixelRatio: 0.01 });
  });
});
