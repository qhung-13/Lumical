import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const id = '33333333-3333-4333-8333-333333333333';
const project = { id, title: 'Calendar for Linh', year: 2028, recipientName: 'Linh', status: 'ARCHIVED', version: 7, stylePresetId: 'classic',
  baseline: { name: { vi: 'Mẫu', en: 'Design' }, layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 } },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const preview = { projectVersion: 7, project,
  months: Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1, caption: index === 0 ? 'A saved note' : null,
    images: index === 0 ? [{ assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', altText: 'Family by the sea', crop: null,
      contentPath: '/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/content' }] : [] })),
  specialDates: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date: '2028-02-29', title: 'Birthday', note: 'A saved date' }],
  readiness: { previewReady: true, arReady: false, finalizationContentReady: false, orderReady: false, issues: { preview: [], ar: ['AR_SETUP_REQUIRED'],
    order: ['CALENDAR_IMAGE_REQUIRED', 'AR_REQUIREMENTS_INCOMPLETE', 'PROJECT_REVIEW_REQUIRED'] } } };

async function openPreview(page: Page) {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
    authenticated: true, principal: { id: '44444444-4444-4444-8444-444444444444', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } }) }));
  await page.route(`**/api/v1/projects/${id}/preview`, route => route.fulfill({ status: 200, headers: { ETag: '"7"', 'Cache-Control': 'private, no-store' },
    contentType: 'application/json', body: JSON.stringify({ data: preview }) }));
  await page.route('**/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/content', route => route.fulfill({ status: 200,
    contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64') }));
  await page.goto(`/projects/${id}/preview`);
}

test('saved preview shows one archived revision, honest readiness and a readable ordered alternative', async ({ page }) => {
  await openPreview(page);
  await expect(page.getByText('Saved revision 7')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(12);
  await expect(page.getByAltText('Family by the sea')).toBeVisible();
  await expect(page.getByRole('article', { name: 'February 2028' })).toContainText('Birthday');
  await expect(page.getByText('AR content has not been set up')).toBeVisible();
  await expect(page.getByText(/do not confirm finalization or checkout eligibility/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'I reviewed saved revision 7' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue to Finalization' })).toBeDisabled();
  await page.getByText('Readable calendar list').click();
  await expect(page.locator('details[open] ol > li')).toHaveCount(12);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('a Preview VERSION_CONFLICT offers refresh and requires review of the refreshed revision', async ({ page }) => {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
    authenticated: true, principal: { id: '44444444-4444-4444-8444-444444444444', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } }) }));
  let calls = 0;
  await page.route(`**/api/v1/projects/${id}/preview`, route => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 412, contentType: 'application/json', body: JSON.stringify({ error: { code: 'VERSION_CONFLICT', currentVersion: 8 } }) });
    const refreshed = { ...preview, projectVersion: 8, project: { ...project, status: 'WORKING', version: 8 } };
    return route.fulfill({ status: 200, headers: { ETag: '"8"', 'Cache-Control': 'private, no-store' }, contentType: 'application/json', body: JSON.stringify({ data: refreshed }) });
  });
  const finalizationPosts: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/finalizations')) finalizationPosts.push(request.url()); });
  await page.goto(`/projects/${id}/preview`);
  await expect(page.getByText(/Project changed while this Preview was open/i)).toBeVisible();
  await page.getByRole('button', { name: 'Refresh saved Preview' }).click();
  await expect(page.getByText('Saved revision 8')).toBeVisible();
  await expect(page.getByRole('button', { name: 'I reviewed saved revision 8' })).toBeVisible();
  expect(finalizationPosts).toEqual([]);
});

test('handoff requires backend content readiness and current revision acknowledgement', async ({ page }) => {
  const workingReady = { ...preview, project: { ...project, status: 'WORKING' }, readiness: {
    ...preview.readiness, finalizationContentReady: true, orderReady: false,
    issues: { ...preview.readiness.issues, order: ['PROJECT_REVIEW_REQUIRED'] },
  } };
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
    authenticated: true, principal: { id: '44444444-4444-4444-8444-444444444444', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } }) }));
  await page.route(`**/api/v1/projects/${id}/preview`, route => route.fulfill({ status: 200, headers: { ETag: '"7"', 'Cache-Control': 'private, no-store' },
    contentType: 'application/json', body: JSON.stringify({ data: workingReady }) }));
  await page.goto(`/projects/${id}/preview`);
  const handoff = page.getByRole('button', { name: 'Continue to Finalization' });
  await expect(handoff).toBeDisabled();
  await page.getByRole('button', { name: 'I reviewed saved revision 7' }).click();
  await expect(handoff).toBeEnabled();
  await handoff.click();
  await expect(page).toHaveURL(`/projects/${id}/finalize?reviewedProjectVersion=7`);
});

test('preview month controls remain usable at compact width and 200% text zoom', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openPreview(page);
  await page.getByRole('button', { name: 'Selected month' }).click();
  await page.getByRole('button', { name: 'February' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article', { name: 'February 2028' })).toContainText('Birthday');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect(page.getByRole('button', { name: 'Whole year' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
