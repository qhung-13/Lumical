import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const id = '33333333-3333-4333-8333-333333333333';
const project = { id, title: 'Calendar for Linh', year: 2027, recipientName: 'Linh', status: 'WORKING', version: 1, stylePresetId: 'classic',
  baseline: { name: { vi: 'Mẫu', en: 'Design' }, layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 } },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

async function setup(page: Page, options: { initialStatus?: 'WORKING' | 'ARCHIVED'; eligible?: boolean; stale?: boolean; rejectDelete?: boolean } = {}) {
  let status = options.initialStatus ?? 'WORKING'; let version = 1; let eligible = options.eligible ?? true; let deleted = false;
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
    authenticated: true, principal: { id: '44444444-4444-4444-8444-444444444444', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } }) }));
  await page.route(`**/api/v1/projects/${id}**`, async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.endsWith('/months') && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { projectVersion: version,
        months: Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1, caption: index === 0 ? 'New year notes' : null })) } }) }); return;
    }
    if (request.method() === 'GET') {
      if (deleted) { await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND' } }) }); return; }
      await route.fulfill({ status: 200, headers: { ETag: `"${version}"` }, contentType: 'application/json', body: JSON.stringify({ data: { ...project, status, version, deletionEligible: eligible } }) }); return;
    }
    if (request.method() === 'POST' && (url.pathname.endsWith('/archive') || url.pathname.endsWith('/restore'))) {
      if (options.stale) { status = 'ARCHIVED'; version = 2; options.stale = false; await route.fulfill({ status: 412, contentType: 'application/json', body: JSON.stringify({ error: { code: 'VERSION_CONFLICT', currentVersion: version } }) }); return; }
      expect(request.headers()['if-match']).toBe(`"${version}"`);
      status = url.pathname.endsWith('/archive') ? 'ARCHIVED' : 'WORKING'; version++;
      await route.fulfill({ status: 200, headers: { ETag: `"${version}"` }, contentType: 'application/json', body: JSON.stringify({ data: { ...project, status, version } }) }); return;
    }
    if (request.method() === 'DELETE') {
      if (options.rejectDelete) { eligible = false; await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'PROJECT_HAS_ORDERS' } }) }); return; }
      deleted = true; await route.fulfill({ status: 204 }); return;
    }
    await route.continue();
  });
  await page.goto(`/projects/${id}`);
  return { get deleted() { return deleted; } };
}

test('owner navigates all twelve months by keyboard and reviews empty months', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await setup(page);
  const tabs = page.getByRole('tablist', { name: 'Calendar months' });
  await expect(tabs.getByRole('tab')).toHaveCount(12);
  await expect(page.getByRole('tabpanel')).toContainText('New year notes');
  await tabs.getByRole('tab', { name: 'January' }).focus();
  await page.keyboard.press('End');
  await expect(tabs.getByRole('tab', { name: 'December' })).toBeFocused();
  await expect(tabs.getByRole('tab', { name: 'December' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toContainText('No saved notes for this month yet.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('archived calendar is read-only and can be restored', async ({ page }) => {
  await setup(page, { initialStatus: 'ARCHIVED' });
  await expect(page.getByText('This calendar is archived and read-only.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archive calendar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore calendar' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('In progress')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archive calendar' })).toBeFocused();
});

test('permanent deletion requires confirmation and is hidden when backend eligibility is false', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('dialog', { name: 'Permanently delete this calendar?' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete permanently' }).last().click();
  await expect(page).toHaveURL(/\/account$/);
  expect(state.deleted).toBe(true);

  await setup(page, { eligible: false });
  await expect(page.getByRole('button', { name: 'Delete permanently' })).toHaveCount(0);
});

test('stale lifecycle version shows feedback and reloads authoritative state', async ({ page }) => {
  await setup(page, { stale: true });
  await page.getByRole('button', { name: 'Archive calendar' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('This calendar changed elsewhere.');
  await expect(page.getByText('Archived', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archive calendar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore calendar' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('In progress')).toBeVisible();
});

test('backend order-history rejection explains the refusal and refreshes deletion eligibility', async ({ page }) => {
  await setup(page, { rejectDelete: true });
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).last().click();
  await expect(page.locator('p[role="alert"]')).toContainText('has order history and cannot be permanently deleted');
  await expect(page.getByRole('button', { name: 'Delete permanently' })).toHaveCount(0);
});
