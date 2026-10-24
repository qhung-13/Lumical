import { test, expect } from '@playwright/test';
import { foundationCopy } from '../src/i18n/foundation';

for (const locale of ['en', 'vi'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${locale}/${theme}: public, form-dialog and Admin visual baseline`, async ({ page, context }) => {
    await context.addCookies([{ name: 'lumical_locale', value: locale, url: 'http://127.0.0.1:3210' }, { name: 'lumical_theme', value: theme, url: 'http://127.0.0.1:3210' }]);
    await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { data: { authenticated: false } } }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [view, path] of [['public', '/'], ['form', '/foundation/form'], ['admin', '/foundation/admin']]) {
      await page.goto(path); await page.evaluate(() => document.fonts.ready);
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        // Collect all composition differences; any mismatch still fails the case.
        await expect.soft(page).toHaveScreenshot(`${view}-${locale}-${theme}-${width}.png`, { fullPage: true, animations: 'disabled' });
        if (view === 'form') {
          await page.getByRole('button', { name: foundationCopy[locale].open, exact: true }).click();
          await expect.soft(page).toHaveScreenshot(`dialog-${locale}-${theme}-${width}.png`, { animations: 'disabled' });
          await page.keyboard.press('Escape');
        }
      }
    }
  });
}
