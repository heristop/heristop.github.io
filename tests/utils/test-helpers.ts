import { type Page, expect } from '@playwright/test';

export async function waitForPageLoad(page: Page) {
  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');

  // Wait for any animations to settle
  await page.waitForTimeout(500);
}

export async function takeFullPageScreenshot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}-full-page.png`, {
    fullPage: true,
    animations: 'disabled',
  });
}

export async function takeViewportScreenshot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}-viewport.png`, {
    animations: 'disabled',
  });
}

export async function waitForImagesLoad(page: Page) {
  // Wait for all images to load with longer timeout and error handling
  try {
    await page.waitForFunction(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.every(img => img.complete && img.naturalHeight !== 0);
    }, { timeout: 10000 });
  } catch (error) {
    // If images don't load within timeout, continue anyway
    console.warn('Some images may not have loaded fully');
  }
}

export const viewports = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
} as const;

export async function testResponsiveScreenshots(page: Page, url: string, testName: string) {
  for (const [device, viewport] of Object.entries(viewports)) {
    await page.setViewportSize(viewport);
    await page.goto(url);
    await waitForPageLoad(page);
    await waitForImagesLoad(page);

    await takeViewportScreenshot(page, `${testName}-${device}`);
    if (device === 'desktop') {
      await takeFullPageScreenshot(page, `${testName}-${device}`);
    }
  }
}