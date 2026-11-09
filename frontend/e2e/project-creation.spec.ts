import { expect, test, type Page } from '@playwright/test';

const templateId = '11111111-1111-4111-8111-111111111111';
const projectId = '33333333-3333-4333-8333-333333333333';
const template = { id: templateId, category: 'GENERAL', publishedRevision: {
  id: '22222222-2222-4222-8222-222222222222', version: 2, publishedAt: '2026-01-01T00:00:00.000Z',
  name: { vi: 'Mẫu ngày vui', en: 'Bright day' }, description: { vi: 'Mẫu lịch tổng hợp', en: 'A joyful calendar design' },
  layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 },
  presets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }, { id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } }],
  price: { currency: 'USD', unitPriceMinor: 2400 },
} };
const project = { id: projectId, title: 'Summer memories', year: new Date().getFullYear(), recipientName: 'Linh', status: 'WORKING', version: 1,
  stylePresetId: 'minimal', baseline: { name: template.publishedRevision.name, layout: template.publishedRevision.layout },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

async function mockJourney(page: Page, options: { unavailable?: boolean } = {}) {
  let authenticated = false; let createCount = 0; let detailGets = 0; const attempts: { headers: Record<string, string>; body: unknown }[] = [];
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: authenticated
    ? { authenticated: true, principal: { id: '44444444-4444-4444-8444-444444444444', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'a'.repeat(64) }
    : { authenticated: false } }) }));
  await page.route('**/api/v1/auth/login', async route => {
    authenticated = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: '44444444-4444-4444-8444-444444444444',
      email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE', csrfToken: 'a'.repeat(64) } }) });
  });
  await page.route(`**/api/v1/templates/${templateId}`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: template }) }));
  await page.route('**/api/v1/projects**', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/projects')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: createCount ? [project] : [], meta: { nextCursor: null, hasMore: false } }) }); return;
    }
    if (request.method() === 'GET' && url.pathname.endsWith(`/projects/${projectId}/months`)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { projectVersion: 1, months: Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1, caption: null })) } }) }); return;
    }
    if (request.method() === 'GET' && url.pathname.endsWith(`/projects/${projectId}`)) {
      detailGets++;
      await route.fulfill({ status: 200, headers: { ETag: '"1"' }, contentType: 'application/json', body: JSON.stringify({ data: { ...project, deletionEligible: true } }) }); return;
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/projects')) {
      attempts.push({ headers: request.headers(), body: request.postDataJSON() }); createCount++;
      if (createCount === 1 && !options.unavailable) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE', messageKey: 'errors.unavailable', requestId: 'req-create', retryable: true, fieldErrors: [] } }) }); return;
      }
      if (options.unavailable) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEMPLATE_UNAVAILABLE', messageKey: 'errors.templateUnavailable', requestId: 'req-template', retryable: false, fieldErrors: [] } }) }); return;
      }
      await route.fulfill({ status: 201, headers: { ETag: '"1"' }, contentType: 'application/json', body: JSON.stringify({ data: project }) }); return;
    }
    await route.continue();
  });
  return { attempts, get detailGets() { return detailGets; } };
}

test('synthetic owner creates, retries the same intent and reopens the persisted Project', async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: 'lumical_locale', value: 'en', url: baseURL! }, { name: 'lumical_theme', value: 'light', url: baseURL! }]);
  const journey = await mockJourney(page);
  await page.goto(`/templates/${templateId}`);
  await page.getByRole('link', { name: 'Create a calendar with this design' }).click();
  await page.getByLabel('Email (required)').fill('owner@example.test');
  await page.getByLabel('Password (required)').fill('synthetic passphrase 2026');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(new RegExp(`/account\\?templateId=${templateId}`));
  await expect(page.getByRole('heading', { name: 'Create your calendar' })).toBeVisible();
  await page.getByLabel('Calendar name (required)').fill('Summer memories');
  await page.getByLabel('Made for (required)').fill('Linh');
  await page.getByLabel('Style (required)').selectOption('minimal');
  await page.getByLabel('Made for (required)').press('Enter');
  await expect(page.getByText(/Your calendar could not be created/u)).toBeVisible();
  await page.getByRole('button', { name: 'Retry previous request' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  await expect(page.getByRole('heading', { name: 'Summer memories' })).toBeVisible();
  expect(journey.attempts).toHaveLength(2);
  expect(journey.attempts[0].headers['idempotency-key']).toBeTruthy();
  expect(journey.attempts[0].headers['idempotency-key']).toBe(journey.attempts[1].headers['idempotency-key']);
  expect(journey.attempts[0].headers['x-csrf-token']).toBe('a'.repeat(64));
  expect(journey.attempts[0].body).toEqual({ templateId, title: 'Summer memories', year: project.year, recipientName: 'Linh', stylePresetId: 'minimal' });
  expect(Object.keys(journey.attempts[0].body as object).sort()).toEqual(['recipientName', 'stylePresetId', 'templateId', 'title', 'year']);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Summer memories' })).toBeVisible();
  await page.goto('/account');
  await expect(page.getByRole('link', { name: /Summer memories/ })).toBeVisible();
  await page.getByRole('link', { name: /Summer memories/ }).click();
  await expect(page.getByRole('heading', { name: 'Summer memories' })).toBeVisible();
  expect(journey.detailGets).toBeGreaterThanOrEqual(3);
});

test('unavailable Template keeps the entered draft and offers a route back to catalog', async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: 'lumical_locale', value: 'vi', url: baseURL! }, { name: 'lumical_theme', value: 'dark', url: baseURL! }]);
  await page.setViewportSize({ width: 320, height: 800 });
  await mockJourney(page, { unavailable: true });
  await page.goto('/login?next=%2Faccount%3FtemplateId=' + templateId);
  await page.getByLabel('Email (bắt buộc)').fill('owner@example.test');
  await page.getByLabel('Mật khẩu (bắt buộc)').fill('synthetic passphrase 2026');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tạo lịch của bạn' })).toBeVisible();
  await page.getByLabel('Tên lịch (bắt buộc)').fill('Lịch của Linh');
  await page.getByLabel('Dành tặng (bắt buộc)').fill('Linh');
  await page.getByLabel('Phong cách (bắt buộc)').selectOption('classic');
  await page.getByRole('button', { name: 'Tạo lịch' }).click();
  await expect(page.getByText(/Mẫu này không còn dùng/u)).toBeVisible();
  await expect(page.getByLabel('Tên lịch (bắt buộc)')).toHaveValue('Lịch của Linh');
  await expect(page.getByRole('link', { name: 'Chọn mẫu khác' })).toHaveAttribute('href', '/templates');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test.describe('creation year across browser/server New Year zones', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  test('does not block a year allowed by the backend when the browser is still in the prior year', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-12-31T17:00:00.000Z') });
    await mockJourney(page);
    const attempts: unknown[] = [];
    await page.route('**/api/v1/projects', async route => {
      if (route.request().method() !== 'POST') { await route.fallback(); return; }
      attempts.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: { data: { ...project, year: 2029 } } });
    });
    await page.goto(`/login?next=${encodeURIComponent(`/account?templateId=${templateId}`)}`);
    await page.getByLabel('Email (required)').fill('owner@example.test');
    await page.getByLabel('Password (required)').fill('synthetic passphrase 2026');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create your calendar' })).toBeVisible();
    expect(await page.evaluate(() => new Date().getFullYear())).toBe(2026);
    await page.getByLabel('Calendar name (required)').fill('New Year boundary');
    await page.getByLabel('Made for (required)').fill('Synthetic recipient');
    await page.getByLabel('Style (required)').selectOption('classic');
    // At this instant the configured backend zone is already in 2027, so 2029
    // is in its current..+2 window. The browser cannot derive that zone locally.
    await page.getByLabel('Calendar year (required)').fill('2029');
    await page.getByRole('button', { name: 'Create calendar', exact: true }).click();
    await expect.poll(() => attempts.length).toBe(1);
    expect(attempts[0]).toMatchObject({ year: 2029 });
  });
});
