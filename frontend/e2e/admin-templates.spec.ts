import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { templateAdminCopy } from '../src/i18n/admin-templates';

// I04-P04 — synthetic Admin Templates flow. The e2e webServer runs with a dead
// BACKEND_URL by design, so the contract is mocked at the browser boundary
// (page.route): no backend, no database, no fake permissions — only the wire
// format from docs/API_CONTRACT.md §17.

const templateId = '11111111-1111-4111-8111-111111111111';
const csrfToken = 'a'.repeat(64);
const adminRow = {
  id: templateId, category: 'BIRTHDAY', availability: 'INACTIVE',
  version: 4, currentPublishedRevisionId: null, publishedRevision: null,
};
const listBody = (data: unknown[] = [adminRow], nextCursor: string | null = null, hasMore = false) =>
  ({ data, meta: { nextCursor, hasMore } });

const errorBody = (code: string, extra: Record<string, unknown> = {}) =>
  ({ error: { code, messageKey: `errors.${code.toLowerCase()}`, requestId: 'req-e2e', retryable: false, fieldErrors: [], ...extra } });

async function mockSession(page: Page) {
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({
    json: { data: { authenticated: true, csrfToken, principal: { id: '33333333-3333-4333-8333-333333333333', email: 'ops@lumical.edu', role: 'ADMIN', accountStatus: 'ACTIVE' } } },
  }));
}

interface AdminWrites {
  revisions: { ifMatch: string | null; csrf: string | null; idempotency: string | null; body: unknown }[];
  availability: { ifMatch: string | null; reason: string | null }[];
  creates: { body: unknown; idempotency: string | null }[];
}

async function mockAdminApi(page: Page, options: { failFirstPublish?: boolean } = {}): Promise<AdminWrites> {
  const writes: AdminWrites = { revisions: [], availability: [], creates: [] };
  await page.route('**/api/v1/admin/templates**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET') {
      const state = url.searchParams.get('state');
      // After a 412 the conflict refresh must observe the server's newer version.
      const current = options.failFirstPublish && writes.revisions.length > 0 ? { ...adminRow, version: 9 } : adminRow;
      const rows = state ? current.availability === state ? [current] : [] : [current];
      return route.fulfill({ json: listBody(rows) });
    }
    if (request.method() === 'POST' && path.endsWith('/revisions')) {
      writes.revisions.push({
        ifMatch: request.headers()['if-match'] ?? null,
        csrf: request.headers()['x-csrf-token'] ?? null,
        idempotency: request.headers()['idempotency-key'] ?? null,
        body: request.postDataJSON(),
      });
      if (options.failFirstPublish && writes.revisions.length === 1) {
        return route.fulfill({ status: 412, json: errorBody('VERSION_CONFLICT', { currentVersion: 9 }) });
      }
      return route.fulfill({ status: 201, json: { data: { ...adminRow, version: 9, publishedRevision: 3, currentPublishedRevisionId: '22222222-2222-4222-8222-222222222222' } } });
    }
    if (request.method() === 'PUT' && path.endsWith('/availability')) {
      writes.availability.push({
        ifMatch: request.headers()['if-match'] ?? null,
        reason: (request.postDataJSON() as { reason?: string }).reason ?? null,
      });
      return route.fulfill({ json: { data: { ...adminRow, availability: (request.postDataJSON() as { availability?: string }).availability ?? 'ACTIVE' } } });
    }
    if (request.method() === 'POST') {
      writes.creates.push({ body: request.postDataJSON(), idempotency: request.headers()['idempotency-key'] ?? null });
      return route.fulfill({ status: 201, json: { data: adminRow } });
    }
    return route.fulfill({ status: 404, json: errorBody('NOT_FOUND') });
  });
  return writes;
}

async function fillRevision(page: Page) {
  await page.getByLabel(/^Name — Vietnamese/).fill('Ngày vui');
  await page.getByLabel(/^Name — English/).fill('Bright day');
  await page.getByLabel(/^Description — Vietnamese/).fill('Thiết kế sinh nhật');
  await page.getByLabel(/^Description — English/).fill('Birthday design');
  await page.getByRole('checkbox', { name: 'Classic' }).check();
  await page.getByLabel(/^Base unit price/).fill('24.00');
}

const axe = (page: Page) => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();

test.beforeEach(async ({ page }) => { await mockSession(page); });

test('admin lists templates, filters by availability and reaches manage', async ({ page }) => {
  const writes = await mockAdminApi(page);
  await page.goto('/admin/templates');
  await expect(page.getByRole('heading', { level: 1, name: templateAdminCopy.en.listTitle })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('link', { name: templateAdminCopy.en.manage })).toBeVisible();

  await page.getByLabel(templateAdminCopy.en.filterLabel).selectOption('ARCHIVED');
  await expect.poll(() => writes.creates.length).toBe(0);
  await expect(page.getByRole('link', { name: templateAdminCopy.en.manage })).toBeHidden();

  await page.getByLabel(templateAdminCopy.en.filterLabel).selectOption('');
  await expect(page.getByRole('link', { name: templateAdminCopy.en.manage })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});

test('create flow: validation blocks review, then a confirmed review POSTs the contract body', async ({ page }) => {
  const writes = await mockAdminApi(page);
  await page.goto('/admin/templates/new');
  await expect(page.getByRole('heading', { level: 1, name: templateAdminCopy.en.newTitle })).toBeVisible();

  // Empty submit → summary + first invalid field focused, no dialog, no POST.
  await page.getByTestId('review-submit').click();
  await expect(page.getByTestId('form-error-summary')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'General' })).toBeFocused();
  await expect(page.getByRole('radio', { name: 'General' })).toHaveAccessibleDescription('This field is required.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes.creates).toEqual([]);

  await page.getByRole('radio', { name: 'Birthday' }).check();
  await fillRevision(page);
  await page.getByTestId('review-submit').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('24.00 USD → 2400');
  await page.getByTestId('review-confirm').click();

  await expect.poll(() => writes.creates.length).toBe(1);
  const body = writes.creates[0].body as { category: string; revision: Record<string, unknown>; reason?: string };
  expect(body.category).toBe('BIRTHDAY');
  expect(Object.keys(body.revision).sort()).toEqual(['description', 'layout', 'name', 'presets', 'price']);
  expect(body.revision.price).toEqual({ currency: 'USD', unitPriceMinor: 2400 });
  expect(writes.creates[0].idempotency).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`/admin/templates/${templateId}$`));
  expect((await axe(page)).violations).toEqual([]);
});

test('publish with review sends If-Match from the loaded version; 412 shows the conflict banner and nothing is auto-resent', async ({ page }) => {
  const writes = await mockAdminApi(page, { failFirstPublish: true });
  await page.goto(`/admin/templates/${templateId}`);
  await expect(page.getByTestId('revision-form')).toBeVisible();

  await fillRevision(page);
  await page.getByLabel(/^Reason/).fill('Approved revision');
  await page.getByTestId('review-submit').click();
  await expect(page.getByRole('dialog')).toContainText('Approved revision');
  await page.getByTestId('review-confirm').click();

  // Conflict: one attempt only, banner states the server version, draft intact.
  const banner = page.getByTestId('conflict-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('9');
  expect(writes.revisions).toHaveLength(1);
  expect(writes.revisions[0].ifMatch).toBe('"4"');
  expect(writes.revisions[0].csrf).toBe(csrfToken);
  await expect(page.getByLabel(/^Name — Vietnamese/)).toHaveValue('Ngày vui');
  expect((await axe(page)).violations).toEqual([]);

  // Conscious refresh → resend with the server's version → success.
  await page.getByTestId('conflict-refresh').click();
  await expect(banner).toHaveCount(0);
  await page.getByTestId('review-submit').click();
  await page.getByTestId('review-confirm').click();
  await expect.poll(() => writes.revisions.length).toBe(2);
  expect(writes.revisions[1].ifMatch).toBe('"9"');
  await expect(page.getByTestId('command-notice')).toContainText('Revision 3 published.');
});

test('availability change requires an audit reason and states the operational result', async ({ page }) => {
  const writes = await mockAdminApi(page);
  await page.goto(`/admin/templates/${templateId}`);
  await expect(page.getByTestId('availability-active')).toBeEnabled();

  await page.getByTestId('availability-active').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('New projects will be able to start from this template.');
  await page.getByTestId('availability-confirm').click();
  await expect(dialog).toContainText('1 to 1000 characters');
  expect(writes.availability).toEqual([]);

  await page.getByLabel(/^Reason \(required\)/).fill('Catalog review complete');
  await page.getByTestId('availability-confirm').click();
  await expect.poll(() => writes.availability.length).toBe(1);
  expect(writes.availability[0]).toEqual({ ifMatch: '"4"', reason: 'Catalog review complete' });
  await expect(page.getByTestId('command-notice')).toContainText('Availability set to Active.');
  expect((await axe(page)).violations).toEqual([]);
});

test('keyboard: skip link, dialog focus trap and Escape without submitting', async ({ page }) => {
  await mockAdminApi(page);
  await page.goto('/admin/templates/new');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: templateAdminCopy.en.skip })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  await page.getByRole('radio', { name: 'Birthday' }).check();
  await fillRevision(page);
  await page.getByTestId('review-submit').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();

  // Native modal: focus enters on Cancel (the safe default), Tab cycles the
  // dialog's controls, and Escape dismisses without submitting.
  await expect(page.getByRole('button', { name: templateAdminCopy.en.cancel })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('review-confirm')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: templateAdminCopy.en.cancel })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('review-submit')).toBeFocused();
  await expect(page.getByLabel(/^Name — Vietnamese/)).toHaveValue('Ngày vui');
});

test('VI locale switches all operational copy', async ({ page }) => {
  await mockAdminApi(page);
  await page.goto('/admin/templates');
  await expect(page.getByRole('link', { name: templateAdminCopy.en.manage })).toBeVisible();
  await page.getByLabel('Language').selectOption('vi');
  await expect(page.getByRole('heading', { level: 1, name: templateAdminCopy.vi.listTitle })).toBeVisible();
  await expect(page.getByRole('link', { name: templateAdminCopy.vi.manage })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  expect((await axe(page)).violations).toEqual([]);
});

for (const [locale, theme] of [['en', 'light'], ['vi', 'dark']] as const) {
  test(`${locale}/${theme}: Admin forms reflow at 320px and respect reduced motion`, async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: 'lumical_locale', value: locale, url: baseURL! },
      { name: 'lumical_theme', value: theme, url: baseURL! },
    ]);
    await page.setViewportSize({ width: 320, height: 820 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAdminApi(page);
    for (const path of ['/admin/templates/new', `/admin/templates/${templateId}`]) {
      await page.goto(path);
      await expect(page.getByTestId('revision-form')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect((await axe(page)).violations).toEqual([]);
      const review = page.getByTestId('review-submit');
      await expect.poll(() => review.evaluate(element => getComputedStyle(element).transitionDuration.split(',').every(value => parseFloat(value) === 0))).toBe(true);
    }
  });
}
