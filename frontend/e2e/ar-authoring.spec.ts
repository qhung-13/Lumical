import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { arAuthoringCopy } from '../src/i18n/ar-authoring';
import { studioCopy } from '../src/i18n/studio';

const id = '33333333-3333-4333-8333-333333333333';
const asset = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
for (const locale of ['en', 'vi'] as const) test(`owner AR save/reopen/remove and compact accessibility (${locale})`, async ({ page, baseURL }) => {
  let version = 2;
  let sessionUnavailable = false;
  let config: null | { monthNumber: number; revealAssetId: string; readableText: string; status: 'PREPARING' } = null;
  await page.context().addCookies([{ name: 'lumical_locale', value: locale, url: baseURL! }, { name: 'lumical_theme', value: 'dark', url: baseURL! }]);
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const reply = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
    if (path.endsWith('/auth/session')) {
      if (sessionUnavailable) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE' } }) });
      return reply({ authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) });
    }
    if (path.endsWith(`/projects/${id}/ar/config`) && request.method() === 'GET') return reply({ config, projectVersion: version });
    if (path.endsWith(`/projects/${id}/ar`)) {
      if (request.method() === 'PUT') {
        expect(request.headers()['if-match']).toBe(`"${version}"`);
        expect(request.headers()['idempotency-key']).toBeTruthy(); expect(request.headers()['x-csrf-token']).toBe('c'.repeat(64));
        config = { ...request.postDataJSON(), status: 'PREPARING' }; version++;
        return reply({ ...config, projectVersion: version });
      }
      if (request.method() === 'DELETE') { config = null; version++; return route.fulfill({ status: 204, headers: { ETag: `"${version}"` } }); }
      throw new Error('GET /ar is reserved for I08 readiness');
    }
    if (path.endsWith(`/projects/${id}/months`)) return reply({ projectVersion: version, months: Array.from({ length: 12 }, (_, i) => ({ monthNumber: i + 1, caption: null, images: [] })) });
    if (path.endsWith(`/projects/${id}/special-dates`)) return reply({ projectVersion: version, events: [] });
    if (path.endsWith(`/projects/${id}`)) return reply({ id, title: 'Synthetic calendar', year: 2027, recipientName: 'Family', status: 'WORKING', version, stylePresetId: 'classic', baseline: { name: { vi: 'Design', en: 'Design' }, layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 } }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', deletionEligible: true,
      stylePresets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }, { id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } }] });
    if (path.endsWith(`/media/${asset}`)) return reply({ id: asset, category: 'IMAGE', status: 'READY', verifiedBytes: 100, contentPath: `/api/v1/media/${asset}/content` });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND' } }) });
  });
  const translations = arAuthoringCopy[locale];
  const copy = { region: translations.heading, existing: translations.assetId, check: translations.verify,
    text: translations.text.IMAGE, save: translations.save, remove: translations.remove,
    confirm: translations.confirm, empty: translations.empty };
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto(`/projects/${id}/studio`);
  const panel = page.getByRole('region', { name: copy.region, exact: true });
  await panel.getByLabel(copy.existing).fill(asset); await panel.getByRole('button', { name: copy.check, exact: true }).click();
  await panel.getByLabel(copy.text).fill('A meaningful family message');
  // Same-session outage keeps AR inputs and verified media in memory, while hiding private UI.
  sessionUnavailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const unavailable = page.getByRole('alert').filter({ hasText: studioCopy[locale].error });
  await expect(unavailable).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Synthetic calendar' })).toHaveCount(0);
  sessionUnavailable = false;
  await unavailable.getByRole('button', { name: studioCopy[locale].retry, exact: true }).click();
  await expect(panel.getByLabel(copy.text)).toHaveValue('A meaningful family message');
  const back = page.getByRole('link', { name: new RegExp(studioCopy[locale].back) });
  await back.click();
  const guard = page.getByRole('dialog', { name: studioCopy[locale].unsavedNav.title });
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: studioCopy[locale].unsavedNav.stay }).click();
  await expect(guard).toBeHidden();
  await expect(back).toBeFocused();
  await expect(panel.getByLabel(copy.text)).toHaveValue('A meaningful family message');
  const save = panel.getByRole('button', { name: copy.save, exact: true });
  await save.focus(); await page.keyboard.press('Enter');
  await expect(panel.getByText(translations.preparing, { exact: true })).toBeVisible();
  await page.reload(); await expect(panel.getByLabel(copy.text)).toHaveValue('A meaningful family message');
  // 320px plus doubled text exercises reflow; this is not a claim of manual browser zoom acceptance.
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await panel.getByRole('button', { name: copy.remove, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: copy.confirm, exact: true }).click();
  await expect(panel.getByText(copy.empty, { exact: true })).toBeVisible();
});

