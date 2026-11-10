import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const assetId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';

test('owner uploads privately and sees READY only after backend status confirms it', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.context().addCookies([
    { name: 'lumical_locale', value: 'vi', url: baseURL! },
    { name: 'lumical_theme', value: 'dark', url: baseURL! },
  ]);
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
    authenticated: true, principal: { id: ownerId, email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64),
  } }) }));

  const creates: { body: unknown; headers: Record<string, string> }[] = [];
  let statusReads = 0;
  await page.route('**/api/v1/media/uploads', async route => {
    const request = route.request();
    creates.push({ body: request.postDataJSON(), headers: request.headers() });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { assetId, upload: {
      url: 'https://api.cloudinary.com/v1_1/lumical/image/upload', fields: { api_key: 'synthetic-public-key', signature: 'synthetic-bounded-signature', timestamp: '1794000000' },
      expiresAt: '2026-11-11T00:00:00.000Z',
    } } }) });
  });
  await page.route('https://api.cloudinary.com/**', route => route.fulfill({ status: 200, contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': new URL(baseURL!).origin }, body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/private/synthetic' }) }));
  await page.route(`**/api/v1/media/${assetId}/finalize`, async route => {
    expect(route.request().headers()['x-csrf-token']).toBe('c'.repeat(64));
    expect(route.request().postDataJSON()).toEqual({ uploadCompleted: true });
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ data: { assetId, status: 'PENDING' } }) });
  });
  await page.route(`**/api/v1/media/${assetId}`, async route => {
    statusReads++;
    if (statusReads === 1) {
      await route.fulfill({ status: 200, headers: { 'Cache-Control': 'private, no-store' }, contentType: 'application/json', body: JSON.stringify({ data: {
        id: assetId, category: 'IMAGE', status: 'PENDING', verifiedBytes: null,
      } }) });
      return;
    }
    await route.fulfill({ status: 200, headers: { 'Cache-Control': 'private, no-store' }, contentType: 'application/json', body: JSON.stringify({ data: {
      id: assetId, category: 'IMAGE', status: 'READY', verifiedBytes: 512,
      contentPath: `/api/v1/media/${assetId}/content`,
    } }) });
  });

  const pageResponse = await page.goto('/media/upload');
  expect(pageResponse?.headers()['content-security-policy']).toContain("connect-src 'self' https://api.cloudinary.com");
  await expect(page.getByRole('heading', { name: 'Tải nội dung cá nhân' })).toBeVisible();
  await page.getByLabel('Loại nội dung').selectOption('IMAGE');
  await page.getByLabel('Chọn tệp').setInputFiles({ name: 'family.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('synthetic image') });
  await page.getByRole('button', { name: 'Tải tệp lên' }).click();
  await expect(page.getByText('Tệp đã được xác minh và sẵn sàng.')).toBeVisible();
  expect(statusReads).toBeGreaterThanOrEqual(2);
  expect(creates).toHaveLength(1);
  expect(creates[0].body).toEqual({ category: 'IMAGE', fileName: 'family.jpg', declaredBytes: 15 });
  expect(creates[0].headers['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{16,128}$/u);
  expect(creates[0].headers['x-csrf-token']).toBe('c'.repeat(64));
  await expect(page.getByRole('status')).toContainText('Sẵn sàng');
  await expect(page.locator('body')).not.toContainText('res.cloudinary.com');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('English and light theme render the file guidance and keep the chooser keyboard reachable', async ({ page, baseURL }) => {
  await page.context().addCookies([
    { name: 'lumical_locale', value: 'en', url: baseURL! },
    { name: 'lumical_theme', value: 'light', url: baseURL! },
  ]);
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
    authenticated: true, principal: { id: ownerId, email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64),
  } }) }));
  await page.goto('/media/upload');
  await expect(page.getByRole('heading', { name: 'Upload personal media' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Media type').selectOption('VIDEO');
  await expect(page.getByText('MP4 or WebM · up to 100 MB · up to 60 seconds.')).toBeVisible();
  const chooser = page.getByLabel('Choose a file');
  await chooser.focus();
  await expect(chooser).toBeFocused();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
