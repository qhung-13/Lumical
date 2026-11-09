import { expect, test, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// This suite has no synthetic response fixtures. It is started ONLY by the
// disposable PostgreSQL harness in backend/scripts/test-project-rest.mjs.
const templateId = process.env.LUMICAL_I05_TEMPLATE_ID!;
const orderedId = process.env.LUMICAL_I05_ORDERED_ID!;
const password = '  TEST ONLY memory passphrase  ';
async function login(request: APIRequestContext, baseURL: string, email: string) {
  const response = await request.post('/api/v1/auth/login', { headers: { Origin: baseURL }, data: { email, password } });
  expect(response.status()).toBe(200);
  return (await response.json()).data.csrfToken as string;
}

test('live create/lost-response replay, reopen, twelve months, owner isolation, inactive baseline and lifecycle', async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  const origin = baseURL!;
  const admin = await browser.newContext({ baseURL });
  const other = await browser.newContext({ baseURL });
  let active = true;
  const adminCsrf = await login(admin.request, origin, 'admin@example.invalid');
  async function availability(value: 'ACTIVE' | 'INACTIVE') {
    const detail = await admin.request.get('/api/v1/admin/templates?limit=50');
    expect(detail.status()).toBe(200);
    const version = (await detail.json()).data.find((item: { id: string }) => item.id === templateId).version;
    const result = await admin.request.put(`/api/v1/admin/templates/${templateId}/availability`, {
      headers: { Origin: origin, 'X-CSRF-Token': adminCsrf, 'Idempotency-Key': crypto.randomUUID(), 'If-Match': `"${version}"` },
      data: { availability: value, reason: 'Synthetic I05 live verification' },
    });
    expect(result.status()).toBe(200); active = value === 'ACTIVE';
  }
  try {
    await page.context().addCookies([{ name: 'lumical_locale', value: 'en', url: origin }]);
    await page.goto('/templates');
    await page.locator(`a[href="/templates/${templateId}"]`).first().click();
    await page.getByRole('link', { name: 'Create a calendar with this design' }).click();
    await page.getByLabel('Email (required)').fill('owner@example.invalid');
    await page.getByLabel('Password (required)').fill(password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create your calendar' })).toBeVisible();
    await page.getByLabel('Calendar name (required)').fill('I05 live calendar');
    await page.getByLabel('Made for (required)').fill('Synthetic recipient');
    await page.getByLabel('Style (required)').selectOption('classic');
    await page.getByLabel('Calendar year (required)').fill(process.env.LUMICAL_I05_CALENDAR_YEAR!);
    // Commit to the real backend, then discard only the first HTTP response.
    const attempts: { key: string; body: unknown; id: string }[] = [];
    await page.route('**/api/v1/projects', async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      const response = await route.fetch(); expect(response.status()).toBe(201);
      attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON(), id: (await response.json()).data.id });
      if (attempts.length === 1) await route.abort(); else await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Create calendar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry previous request' })).toBeEnabled();
    await availability('INACTIVE');
    expect((await page.request.get(`/api/v1/templates/${templateId}`)).status()).toBe(404);
    await page.getByRole('button', { name: 'Retry previous request' }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    const id = attempts[0].id;
    expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
    const csrf = (await (await page.request.get('/api/v1/auth/session')).json()).data.csrfToken;
    const headers = { Origin: origin, 'X-CSRF-Token': csrf };
    const refused = await page.request.post('/api/v1/projects', { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: attempts[0].body });
    expect(refused.status()).toBe(409); expect((await refused.json()).error.code).toBe('TEMPLATE_UNAVAILABLE');
    await expect(page.getByRole('heading', { name: 'I05 live calendar' })).toBeVisible();
    await page.reload();
    const tabs = page.getByRole('tablist', { name: 'Calendar months' });
    await expect(tabs.getByRole('tab')).toHaveCount(12);
    for (const tab of await tabs.getByRole('tab').all()) { await tab.click(); await expect(tab).toHaveAttribute('aria-selected', 'true'); }
    await page.goto('/account');
    await page.getByRole('link', { name: /I05 live calendar/ }).click();
    await expect(page.getByRole('heading', { name: 'I05 live calendar' })).toBeVisible();
    const otherCsrf = await login(other.request, origin, 'other@example.invalid');
    expect((await other.request.get(`/api/v1/projects/${id}`)).status()).toBe(404);
    expect((await other.request.get(`/api/v1/projects/${id}/months`)).status()).toBe(404);
    expect((await other.request.patch(`/api/v1/projects/${id}`, { headers: { Origin: origin, 'X-CSRF-Token': otherCsrf, 'If-Match': '"1"' }, data: { title: 'Denied' } })).status()).toBe(404);
    await page.getByRole('button', { name: 'Archive calendar' }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByText('This calendar is archived and read-only.')).toBeVisible();
    await page.getByRole('button', { name: 'Restore calendar' }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByText('In progress', { exact: true })).toBeVisible();
    // An independent writer advances the actual root behind the browser's v3 view.
    expect((await page.request.post(`/api/v1/projects/${id}/archive`, { headers: { ...headers, 'If-Match': '"3"' } })).status()).toBe(200);
    const stale = page.waitForResponse(response => response.url().endsWith(`/${id}/archive`) && response.status() === 412);
    await page.getByRole('button', { name: 'Archive calendar' }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await stale;
    await expect(page.getByText('This calendar is archived and read-only.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('This calendar changed elsewhere.');
    await page.getByRole('button', { name: 'Restore calendar' }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByText('In progress', { exact: true })).toBeVisible();
    expect((await (await page.request.get(`/api/v1/projects/${id}`)).json()).data.version).toBe(5);
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await page.getByRole('button', { name: 'Delete permanently', exact: true }).last().click();
    await expect(page).toHaveURL(/\/account$/);
    expect((await page.request.get(`/api/v1/projects/${id}`)).status()).toBe(404);
    await expect(page.getByRole('link', { name: /I05 live calendar/ })).toHaveCount(0);
  } finally {
    if (!active) await availability('ACTIVE');
    await other.close(); await admin.close();
  }
});

for (const locale of ['vi', 'en']) for (const theme of ['light', 'dark']) {
  test(`live cancelled Order history and twelve-month reflow: ${locale}/${theme}`, async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    const origin = baseURL!;
    const csrf = await login(page.request, origin, 'owner@example.invalid');
    await page.context().addCookies([{ name: 'lumical_locale', value: locale, url: origin }, { name: 'lumical_theme', value: theme, url: origin }]);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/projects/${orderedId}`);
    await expect(page.getByRole('tab')).toHaveCount(12);
    await expect(page.getByRole('button', { name: locale === 'en' ? 'Delete permanently' : 'Xóa vĩnh viễn' })).toHaveCount(0);
    const detail = await page.request.get(`/api/v1/projects/${orderedId}`);
    const data = (await detail.json()).data; expect(data.deletionEligible).toBe(false);
    const deletion = await page.request.delete(`/api/v1/projects/${orderedId}`, { headers: { Origin: origin, 'X-CSRF-Token': csrf, 'If-Match': `"${data.version}"` }, data: { confirmed: true } });
    expect(deletion.status()).toBe(409); expect((await deletion.json()).error.code).toBe('PROJECT_HAS_ORDERS');
    await page.getByRole('tab').first().focus(); await page.keyboard.press('End');
    await expect(page.getByRole('tab').last()).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test.describe('live New Year timezone boundary', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  test('backend rejects the browser old year and accepts its configured current year plus two', async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    await page.clock.install({ time: new Date(process.env.LUMICAL_I05_BOUNDARY_TIME!) });
    await login(page.request, baseURL!, 'owner@example.invalid');
    await page.context().addCookies([{ name: 'lumical_locale', value: 'en', url: baseURL! }]);
    await page.goto(`/account?templateId=${templateId}`);
    await expect(page.getByRole('heading', { name: 'Create your calendar' })).toBeVisible();
    expect(await page.evaluate(() => new Date().getFullYear())).toBe(2026);
    await page.getByLabel('Calendar name (required)').fill('Live New Year boundary');
    await page.getByLabel('Made for (required)').fill('Synthetic recipient');
    await page.getByLabel('Style (required)').selectOption('classic');
    await page.getByLabel('Calendar year (required)').fill('2026');
    const refused = page.waitForResponse(response => response.url().endsWith('/api/v1/projects') && response.request().method() === 'POST' && response.status() === 422);
    await page.getByRole('button', { name: 'Create calendar', exact: true }).click();
    expect((await (await refused).json()).error.fieldErrors[0].path).toBe('year');
    await expect(page.getByText('Choose this year or one of the next two years.')).toBeVisible();
    await expect(page.getByLabel('Calendar year (required)')).toHaveValue('2026');
    await page.getByLabel('Calendar year (required)').fill('2029');
    await page.getByRole('button', { name: 'Create calendar', exact: true }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    const detail = await page.request.get(`/api/v1${new URL(page.url()).pathname}`);
    expect(detail.status()).toBe(200); expect((await detail.json()).data.year).toBe(2029);
    await expect(page.getByRole('tab')).toHaveCount(12);
  });
});
