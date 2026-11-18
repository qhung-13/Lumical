import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { foundationCopy } from '../src/i18n/foundation';
import { identityCopy } from '../src/i18n/identity';
import { productCopy } from '../src/i18n/product';
import { templateCopy } from '../src/i18n/templates';
import { projectCopy } from '../src/features/calendar-projects/copy';

const templateId = '11111111-1111-4111-8111-111111111111';
const name = { en: 'A year together', vi: 'Một năm bên nhau' };
const design = {
  id: templateId, category: 'ANNIVERSARY', publishedRevision: {
    id: '22222222-2222-4222-8222-222222222222', version: 1, publishedAt: '2026-02-01T00:00:00.000Z',
    name, description: { en: 'A photo calendar for shared memories', vi: 'Lịch ảnh lưu giữ những kỷ niệm chung' },
    layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
    presets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }], price: { currency: 'USD', unitPriceMinor: 1850 },
  },
};
const noMore = { nextCursor: null, hasMore: false };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { data: { authenticated: false } } }));
  await page.route('**/api/v1/templates**', route => route.fulfill({ json:
    new URL(route.request().url()).pathname.endsWith(`/${templateId}`) ? { data: design } : { data: [design], meta: noMore },
  }));
});

for (const locale of ['en', 'vi'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${locale}/${theme}: Home reflows, shows published designs and supports compact keyboard navigation`, async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(60_000);
    const product = productCopy[locale];
    const templates = templateCopy[locale];
    await context.addCookies([{ name: 'lumical_locale', value: locale, url: baseURL! }, { name: 'lumical_theme', value: theme, url: baseURL! }]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByRole('heading', { level: 1, name: product.title })).toBeVisible();
    await expect(page.getByText(product.sampleCaption)).toBeVisible();
    expect(await page.getByRole('img', { name: product.sampleAlt }).evaluate(async img => {
      await (img as HTMLImageElement).decode();
      return (img as HTMLImageElement).naturalWidth;
    })).toBeGreaterThan(0);
    const card = page.getByRole('link', { name: `${templates.open}: ${name[locale]}` });
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1440, 1280, 960, 768, 600, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (testInfo.project.name === 'chromium' && (width === 1440 || width === 375)) {
        await page.screenshot({ path: testInfo.outputPath(`home-${locale}-${theme}-${width}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: templates.skip })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    await card.focus();
    await expect(card).toHaveCSS('outline-style', 'solid');
    const nav = page.getByRole('navigation', { name: templates.navigation });
    const menu = page.getByRole('button', { name: product.menu });
    await expect(nav).toBeHidden();
    await menu.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link', { name: templates.home, exact: true })).toBeFocused();
    await expect(nav.getByRole('link', { name: templates.home, exact: true })).toHaveAttribute('aria-current', 'page');
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    await expect(nav).toBeHidden();
  });
}

test('guest can follow Home to catalog, detail, registration and login', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: templateCopy.en.navigation });
  await expect(navigation.getByRole('link', { name: productCopy.en.media })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: productCopy.en.admin })).toHaveCount(0);
  await page.getByRole('link', { name: productCopy.en.browse }).click();
  await expect(navigation.getByRole('link', { name: templateCopy.en.catalog, exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: `${templateCopy.en.open}: ${name.en}` }).click();
  await expect(page.getByRole('heading', { name: name.en, level: 1 })).toBeVisible();
  await expect(navigation.getByRole('link', { name: templateCopy.en.catalog, exact: true })).toHaveAttribute('aria-current', 'location');
  await navigation.getByRole('link', { name: identityCopy.en.register }).click();
  await expect(page).toHaveURL('/register');
  await expect(page.getByRole('heading', { name: identityCopy.en.register })).toBeVisible();
  await page.getByRole('link', { name: identityCopy.en.login }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: identityCopy.en.login })).toBeVisible();
});

test('owner reaches My calendars and keeps language and theme across navigation', async ({ page }) => {
  const principal = { id: '33333333-3333-4333-8333-333333333333', email: 'owner@example.invalid', role: 'USER', accountStatus: 'ACTIVE' };
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { data: { authenticated: true, principal, csrfToken: 'a'.repeat(64) } } }));
  await page.route('**/api/v1/projects**', route => route.fulfill({ json: { data: [], meta: noMore } }));
  await page.goto('/');
  const navigation = page.getByRole('navigation');
  await expect(navigation.getByRole('link', { name: productCopy.en.media })).toHaveAttribute('href', '/media/upload');
  await expect(navigation.getByRole('link', { name: identityCopy.en.login })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: productCopy.en.admin })).toHaveCount(0);
  await page.getByLabel(foundationCopy.en.theme).selectOption('dark');
  await page.getByLabel(foundationCopy.en.language).selectOption('vi');
  await navigation.getByRole('link', { name: productCopy.vi.calendars }).click();
  await expect(page).toHaveURL('/account');
  await expect(page.getByRole('heading', { name: projectCopy.vi.title })).toBeVisible();
  await expect(navigation.getByRole('link', { name: productCopy.vi.calendars })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('verified Admin gets an entry to the existing Templates workspace', async ({ page }) => {
  const principal = { id: '44444444-4444-4444-8444-444444444444', email: 'admin@example.invalid', role: 'ADMIN', accountStatus: 'ACTIVE' };
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { data: { authenticated: true, principal, csrfToken: 'a'.repeat(64) } } }));
  await page.goto('/');
  await expect(page.getByRole('link', { name: productCopy.en.admin })).toHaveAttribute('href', '/admin/templates');
});
