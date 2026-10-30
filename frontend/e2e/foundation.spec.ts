import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { foundationCopy } from '../src/i18n/foundation';
import { templateCopy } from '../src/i18n/templates';

const views = ['/', '/foundation/form', '/foundation/admin'];
const templateId = '11111111-1111-4111-8111-111111111111';
const templateFixture = {
  id: templateId, category: 'BIRTHDAY', publishedRevision: {
    id: '22222222-2222-4222-8222-222222222222', version: 2, publishedAt: '2026-02-01T00:00:00.000Z',
    name: { vi: 'Ngày vui', en: 'Bright day' }, description: { vi: 'Thiết kế cho sinh nhật', en: 'A birthday calendar design' },
    layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 },
    presets: [{ id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } }], price: { currency: 'USD', unitPriceMinor: 1450 },
  },
};
test.beforeEach(async ({ page }) => {
  // Anonymous UI fixture only; I02's separate PostgreSQL/Compose tests prove auth.
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { data: { authenticated: false } } }));
});

async function mockTemplateApi(page: Page) {
  await page.route('**/api/v1/templates**', route => {
    const detail = new URL(route.request().url()).pathname.endsWith(`/${templateId}`);
    return route.fulfill({ json: { data: detail ? templateFixture : { data: [templateFixture], meta: { nextCursor: null, hasMore: false } } } });
  });
}

test('guest selects a design, authenticates, and retains template context without creating a Project', async ({ page }) => {
  await mockTemplateApi(page);
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { data: {
    id: '33333333-3333-4333-8333-333333333333', email: 'demo@example.invalid', role: 'USER', accountStatus: 'ACTIVE', csrfToken: 'a'.repeat(64),
  } } }));
  await page.route('**/api/v1/account/me', route => route.fulfill({ json: { data: {
    id: '33333333-3333-4333-8333-333333333333', email: 'demo@example.invalid', role: 'USER', accountStatus: 'ACTIVE',
  } } }));
  const projectWrites: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && /\/api\/v1\/projects(?:\?|$)/.test(request.url())) projectWrites.push(request.url()); });

  await page.goto('/templates');
  await page.getByRole('link', { name: 'View design: Bright day' }).click();
  await expect(page).toHaveURL(new RegExp(`/templates/${templateId}$`));
  const cta = page.getByRole('link', { name: templateCopy.en.continueCalendar });
  await expect(cta).toHaveAttribute('href', `/login?next=${encodeURIComponent(`/account?templateId=${templateId}`)}`);
  await cta.click();
  await expect(page).toHaveURL(url => url.pathname === '/login' && url.searchParams.get('next') === `/account?templateId=${templateId}`);
  await page.getByLabel('Email (required)').fill('demo@example.invalid');
  await page.getByLabel('Password (required)').fill('TEST ONLY passphrase');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(`/account?templateId=${templateId}`);
  await expect(page.getByRole('heading', { name: templateCopy.en.handoffTitle })).toBeVisible();
  await expect(page.getByText(templateCopy.en.handoffBody)).toBeVisible();
  expect(projectWrites).toEqual([]);
});

for (const locale of ['en', 'vi'] as const) for (const theme of ['light', 'dark'] as const) test(`${locale}/${theme}: catalog and detail reflow, stay keyboard reachable and pass axe`, async ({ page, context }) => {
  await context.addCookies([
    { name: 'lumical_locale', value: locale, url: 'http://127.0.0.1:3210' },
    { name: 'lumical_theme', value: theme, url: 'http://127.0.0.1:3210' },
  ]);
  await mockTemplateApi(page);
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto('/templates');
  const copy = templateCopy[locale];
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByLabel(copy.search)).toBeVisible();
  await expect(page.getByLabel(copy.category)).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(copy.open) }).first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  for (const width of [320, 375, 600, 960, 1280]) {
    await page.setViewportSize({ width, height: 820 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: copy.skip })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const designLink = page.getByRole('link', { name: `${copy.open}: ${templateFixture.publishedRevision.name[locale]}` });
  await designLink.focus(); await expect(designLink).toBeFocused();
  await expect(designLink).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/templates/${templateId}$`));
  await expect(page.getByRole('heading', { level: 1, name: templateFixture.publishedRevision.name[locale] })).toBeVisible();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 820 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  }
});
async function noHorizontalLoss(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const clipped = await page.locator('main button, main label, main h1, main h2').evaluateAll(elements => elements.filter(element => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1).map(element => element.textContent));
  expect(clipped).toEqual([]);
}
for (const locale of ['en', 'vi'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${locale}/${theme}: all compositions reflow, have contrast and retain navigation at 200% text size`, async ({ page, context }, testInfo) => {
    await context.addCookies([
      { name: 'lumical_locale', value: locale, url: 'http://127.0.0.1:3210' },
      { name: 'lumical_theme', value: theme, url: 'http://127.0.0.1:3210' },
    ]);
    for (const path of views) {
      await page.goto(path); await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(locale => document.fonts.check('400 16px "Be Vietnam Pro"', locale === 'vi' ? 'Ký ức tháng Mười' : 'Meaningful details') && document.fonts.check('700 32px "Baloo 2"', locale === 'vi' ? 'Tiếng Việt' : 'Meaningful details'), locale)).toBe(true);
      const fonts = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /\.woff2?(\?|$)/.test(entry.name)).map(entry => entry.name));
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.every(url => new URL(url).origin === 'http://127.0.0.1:3210')).toBe(true);
      if (locale === 'en') expect(fonts.filter(url => /(?:be-vietnam-pro-vietnamese-(?:600|700)|baloo-2-vietnamese)/.test(url))).toEqual([]);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      for (const width of [320, 375, 600, 768, 960, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 }); await noHorizontalLoss(page);
      }
      const copy = foundationCopy[locale];
      expect(await page.getByRole('navigation', { name: copy.navigation }).locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(views);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
      await page.setViewportSize({ width: 320, height: 900 });
      if (path === '/foundation/form') {
        await page.getByRole('button', { name: copy.validate, exact: true }).click();
        await expect(page.locator('input[name="example"]')).toHaveAttribute('aria-invalid', 'true');
      }
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
      if (testInfo.project.name === 'chromium') {
        const image = await page.screenshot({ fullPage: true });
        await testInfo.attach(`${path.replaceAll('/', '-') || 'public'}-${locale}-${theme}-320`, { body: image, contentType: 'image/png' });
      }
      // Actual browser text resizing, not a claim of browser toolbar zoom.
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      for (const width of [320, 1280]) { await page.setViewportSize({ width, height: 900 }); await noHorizontalLoss(page); }
      if (path === '/foundation/form') {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.getByRole('button', { name: copy.open, exact: true }).click();
        const dialog = page.getByRole('dialog', { name: copy.dialogTitle });
        expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await expect(dialog.getByRole('button', { name: copy.cancel, exact: true })).toBeFocused();
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
        await page.keyboard.press('Escape');
      }
      await page.getByLabel(copy.language, { exact: true }).selectOption(locale);
      await expect(page.getByLabel(copy.theme, { exact: true })).toBeVisible();
    }
  });
}

test('OS theme follows changes; explicit preferences survive reload and navigation without JS or sensitive storage', async ({ page, context, browser }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' }); await page.goto('/');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(24, 21, 18)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 247, 241)');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await page.getByLabel('Language', { exact: true }).selectOption('vi');
  await page.getByRole('link', { name: foundationCopy.vi.admin, exact: true }).click();
  await expect(page).toHaveURL(/\/foundation\/admin$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(foundationCopy.vi.adminTitle);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(24, 21, 18)');
  expect((await context.cookies()).map(cookie => cookie.name).sort()).toEqual(['lumical_locale', 'lumical_theme']);
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({});
  const noJs = await browser.newContext({ javaScriptEnabled: false, storageState: await context.storageState() });
  try {
    const serverPage = await noJs.newPage(); await serverPage.goto('http://127.0.0.1:3210/');
    await expect(serverPage.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(serverPage.locator('body')).toHaveCSS('background-color', 'rgb(24, 21, 18)');
  } finally { await noJs.close(); }
});

for (const locale of ['en', 'vi'] as const) test(`${locale}: keyboard-only dialog entry, trap, safe dismissal, explicit action and background blocking`, async ({ page, context }) => {
  await context.addCookies([{ name: 'lumical_locale', value: locale, url: 'http://127.0.0.1:3210' }]);
  const copy = foundationCopy[locale];
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.setViewportSize({ width: 320, height: 640 }); await page.goto('/foundation/form');
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: copy.skip })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('main')).toBeFocused();
  await page.keyboard.press('Tab'); const input = page.getByRole('textbox', { name: `${copy.label} (${copy.required})`, exact: true });
  await expect(input).toBeFocused(); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(input).toBeFocused(); await expect(input).toHaveAttribute('aria-invalid', 'true');
  await input.fill('Ký ức e\u0301'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); const trigger = page.getByRole('button', { name: copy.open, exact: true }); await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter'); const dialog = page.getByRole('dialog', { name: copy.dialogTitle });
  const cancel = dialog.getByRole('button', { name: copy.cancel, exact: true }); await expect(cancel).toBeFocused();
  await expect(cancel).toHaveCSS('outline-style', 'solid'); await expect(cancel).toHaveCSS('outline-width', '2px');
  await expect(cancel).toHaveCSS('transition-duration', '0s');
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: copy.clear, exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); const note = dialog.getByRole('textbox'); await expect(note).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: copy.clear, exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await expect(dialog).toBeVisible();
  await expect(input).toHaveValue('Ký ức e\u0301');
  // Browser-native modal prevents programmatic focus and pointer access to background.
  await input.evaluate(element => element.focus()); await expect(note).toBeFocused();
  await page.mouse.click(2, 2); await expect(dialog).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await expect(input).toHaveValue('Ký ức e\u0301');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await expect(input).toHaveValue('Ký ức e\u0301');
  await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(dialog).not.toBeVisible(); await expect(input).toHaveValue(''); await expect(trigger).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: copy.cleared })).toBeVisible();
});

test('identity pages consume shared controls and presentation preferences', async ({ page, context }) => {
  await context.addCookies([{ name: 'lumical_locale', value: 'vi', url: 'http://127.0.0.1:3210' }, { name: 'lumical_theme', value: 'dark', url: 'http://127.0.0.1:3210' }]);
  await page.goto('/login'); await expect(page.getByLabel('Mật khẩu (bắt buộc)')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(24, 21, 18)');
  await page.getByLabel('Ngôn ngữ').selectOption('en');
  await expect(page.getByLabel('Password (required)')).toHaveAttribute('autocomplete', 'current-password');
});

test('Dialog preserves native descendant keys and survives a queued close followed by immediate reopen', async ({ page }) => {
  await page.goto('/foundation/form');
  const copy = foundationCopy.en;
  const trigger = page.getByRole('button', { name: copy.open, exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: copy.dialogTitle });
  // Exercise the shared composite with native descendants without adding a demo route.
  await dialog.evaluate(element => {
    const textarea = document.createElement('textarea'); textarea.setAttribute('aria-label', 'Multiline probe');
    const link = document.createElement('a'); link.href = '#dialog-help'; link.textContent = 'Dialog help'; link.tabIndex = 0;
    element.querySelector('h2')!.after(textarea, link);
    const group = document.createElement('fieldset');
    for (const [index, label] of ['First choice', 'Second choice'].entries()) {
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'native-probe'; radio.checked = index === 0;
      radio.setAttribute('aria-label', label); group.append(radio);
    }
    element.querySelector('h2')!.after(group);
  });
  const notes = dialog.getByRole('textbox', { name: 'Multiline probe' });
  await notes.focus(); await page.keyboard.type('First'); await page.keyboard.press('Enter'); await page.keyboard.type('Second');
  await expect(notes).toHaveValue('First\nSecond');
  await dialog.getByRole('link', { name: 'Dialog help' }).focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#dialog-help$/); await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: 'First choice' }).focus(); await page.keyboard.press('Tab'); await expect(notes).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('radio', { name: 'First choice' })).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(dialog.getByRole('radio', { name: 'Second choice' })).toBeChecked();
  await page.keyboard.press('Tab'); await expect(notes).toBeFocused();
  // Observe the actual asynchronous close event, then assert it cannot steal focus.
  await dialog.evaluate(element => new Promise<void>(resolve => {
    element.addEventListener('close', () => queueMicrotask(resolve), { once: true });
    (element as HTMLDialogElement).close();
    document.querySelector<HTMLButtonElement>(`button[aria-controls="${element.id}"]`)!.click();
  }));
  await expect(dialog).toBeVisible(); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.getByRole('button', { name: copy.cancel, exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});

for (const locale of ['en', 'vi'] as const) test(`${locale}: outline and ghost examples acknowledge activation without requests`, async ({ page, context }) => {
  await context.addCookies([{ name: 'lumical_locale', value: locale, url: 'http://127.0.0.1:3210' }]);
  await page.goto('/foundation/form');
  const requests: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') requests.push(request.url()); });
  for (const variant of ['outline', 'ghost']) {
    await page.locator(`button[data-variant="${variant}"]`).focus(); await page.keyboard.press('Enter');
    await expect(page.locator('p[role="status"]')).toHaveText(foundationCopy[locale].activated);
    // Clear the prior outcome so each control must independently provide feedback.
    await page.locator('input[name="example"]').fill(variant);
    await expect(page.locator('p[role="status"]')).toBeEmpty();
  }
  expect(requests).toEqual([]);
});

test('rendered control boundaries, focus and filled action states meet approved contrast in both themes', async ({ page }) => {
  const ratio = async (selector: string, foreground: string, background: string) => page.locator(selector).evaluate((element, properties) => {
    const style = getComputedStyle(element);
    const luminance = (value: string) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
      const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(byte => byte / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const a = luminance(style.getPropertyValue(properties.foreground));
    const b = luminance(style.getPropertyValue(properties.background));
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, { foreground, background });
  await page.goto('/foundation/form');
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    expect(await ratio('input[name="example"]', 'border-top-color', 'background-color')).toBeGreaterThanOrEqual(3);
    const action = page.locator('button[data-variant="primary"]');
    for (const state of ['normal', 'hover', 'pressed']) {
      if (state !== 'normal') await action.hover();
      if (state === 'pressed') await page.mouse.down();
      expect(await ratio('button[data-variant="primary"]', 'color', 'background-color')).toBeGreaterThanOrEqual(4.5);
      if (state === 'pressed') await page.mouse.up();
    }
    await page.getByRole('button', { name: foundationCopy.en.open, exact: true }).click();
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    expect(await ratio('dialog button[data-variant="secondary"]', 'outline-color', 'background-color')).toBeGreaterThanOrEqual(3);
    const danger = page.locator('button[data-variant="destructive"]');
    for (const state of ['normal', 'hover', 'pressed']) {
      if (state !== 'normal') await danger.hover();
      if (state === 'pressed') await page.mouse.down();
      expect(await ratio('button[data-variant="destructive"]', 'color', 'background-color')).toBeGreaterThanOrEqual(4.5);
      // Avoid dispatching a confirmation while measuring pressed styling.
      if (state === 'pressed') { await page.mouse.move(0, 0); await page.mouse.up(); }
    }
    await page.keyboard.press('Escape');
  }
});
