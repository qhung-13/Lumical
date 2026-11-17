import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const id = '33333333-3333-4333-8333-333333333333';
const createProject = () => ({ id, title: 'Synthetic family calendar', year: 2027, recipientName: 'Grandma', status: 'WORKING', version: 2,
  stylePresetId: 'classic', baseline: { name: { vi: 'Mẫu gia đình', en: 'Family design' }, layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 } },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', deletionEligible: true });
const createMonths = () => ({ projectVersion: 2, months: Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1,
  caption: index === 0 ? 'Saved January note' : null,
  images: index === 1 ? [{ assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', altText: 'A garden photo', crop: null }] : [] })) });

for (const locale of ['vi', 'en']) for (const theme of ['light', 'dark']) {
  test(`Studio shell is keyboard usable and reflows at 320px: ${locale}/${theme}`, async ({ page, baseURL }) => {
    const project = createProject();
    const months = createMonths();
    await page.context().addCookies([
      { name: 'lumical_locale', value: locale, url: baseURL! },
      { name: 'lumical_theme', value: theme, url: baseURL! },
    ]);
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/content')) {
        await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
        return;
      }
      if (path.endsWith('/months/1') && route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() as { caption: string | null; images: typeof months.months[number]['images'] };
        months.projectVersion += 1;
        project.version += 1;
        months.months[0] = { monthNumber: 1, ...body };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { monthNumber: 1,
          caption: body.caption, images: body.images, projectVersion: months.projectVersion } }) });
        return;
      }
      const data = path.endsWith('/auth/session')
        ? { data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } }
        : path.endsWith(`/projects/${id}/months`) ? { data: months }
          : path.endsWith(`/projects/${id}`) ? { data: project }
            : path.endsWith('/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ? { data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', category: 'IMAGE', status: 'READY', verifiedBytes: 100, contentPath: '/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/content' } }
            : { error: { code: 'NOT_FOUND' } };
      await route.fulfill({ status: path.endsWith('/auth/session') || path.endsWith(`/projects/${id}`) || path.endsWith(`/projects/${id}/months`) || path.endsWith('/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ? 200 : 404,
        contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto(`/projects/${id}/studio`);
    const tablist = page.getByRole('tablist');
    await expect(tablist.getByRole('tab')).toHaveCount(12);
    for (const tab of await tablist.getByRole('tab').all()) {
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    }
    await tablist.getByRole('tab').first().focus();
    await page.keyboard.press('End');
    await expect(tablist.getByRole('tab').last()).toBeFocused();
    await tablist.getByRole('tab').first().click();
    await expect(page.getByText(locale === 'en' ? 'Loaded saved version 2' : 'Đang xem phiên bản đã lưu 2', { exact: true })).toBeVisible();
    await expect(page.getByText(locale === 'en' ? 'This is not a print proof.' : 'không phải bản duyệt in.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await expect(page.getByRole('link', { name: locale === 'en' ? /Back to calendar/ : /Quay lại lịch/ })).toBeVisible();
    await expect(page.getByLabel(locale === 'en' ? 'Language' : 'Ngôn ngữ')).toBeVisible();
    await page.getByLabel(locale === 'en' ? /Month message/ : /Lời nhắn cho tháng/).fill('A saved Studio message');
    await page.getByRole('button', { name: locale === 'en' ? 'Use a Ready image 1' : 'Dùng ảnh Ready 1' }).click();
    await page.getByLabel(locale === 'en' ? 'Alternative text for image 1' : 'Mô tả ảnh 1').fill('Family in the garden');
    await page.getByRole('button', { name: locale === 'en' ? 'Save month' : 'Lưu tháng' }).click();
    await expect(page.getByText(locale === 'en' ? 'Month saved.' : 'Đã lưu tháng.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Family in the garden' })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(locale === 'en' ? /Month message/ : /Lời nhắn cho tháng/)).toHaveValue('A saved Studio message');
    await expect(page.getByRole('img', { name: 'Family in the garden' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
