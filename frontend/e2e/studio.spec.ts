import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { studioCopy } from '../src/i18n/studio';

const id = '33333333-3333-4333-8333-333333333333';
const createProject = () => ({ id, title: 'Synthetic family calendar', year: 2027, recipientName: 'Grandma', status: 'WORKING', version: 2,
  stylePresetId: 'classic', baseline: { name: { vi: 'Mẫu gia đình', en: 'Family design' }, layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 } },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', deletionEligible: true,
  stylePresets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }, { id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } }] });
const createMonths = () => ({ projectVersion: 2, months: Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1,
  caption: index === 0 ? 'Saved January note' : null,
  images: index === 1 ? [{ assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', altText: 'A garden photo', crop: null }] : [] })) });

for (const locale of ['vi', 'en']) for (const theme of ['light', 'dark']) {
  test(`Studio shell is keyboard usable and reflows at 320px: ${locale}/${theme}`, async ({ page, baseURL }) => {
    const project = createProject();
    const months = createMonths();
    const specialDates: { projectVersion: number; events: { id: string; date: string; title: string; note: string | null }[] } = { projectVersion: 2, events: [] };
    await page.context().addCookies([
      { name: 'lumical_locale', value: locale, url: baseURL! },
      { name: 'lumical_theme', value: theme, url: baseURL! },
    ]);
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith(`/projects/${id}/ar/config`)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { config: null, projectVersion: project.version } }) }); return;
      }
      if (path.endsWith('/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/content')) {
        await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
        return;
      }
      if (path.endsWith('/months/1') && route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() as { caption: string | null; images: typeof months.months[number]['images'] };
        months.projectVersion += 1;
        project.version += 1;
        specialDates.projectVersion = project.version;
        months.months[0] = { monthNumber: 1, ...body };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { monthNumber: 1,
          caption: body.caption, images: body.images, projectVersion: months.projectVersion } }) });
        return;
      }
      if (path.endsWith(`/projects/${id}/special-dates`) && route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as { date: string; title: string; note: string | null };
        const event = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', ...body };
        specialDates.events.push(event);
        specialDates.projectVersion = ++project.version;
        months.projectVersion = project.version;
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { ...event, projectVersion: project.version } }) });
        return;
      }
      if (path.match(new RegExp(`/projects/${id}/special-dates/[a-f0-9-]+$`)) && route.request().method() === 'PUT') {
        const eventId = path.split('/').at(-1)!;
        const body = route.request().postDataJSON() as { date: string; title: string; note: string | null };
        const index = specialDates.events.findIndex(event => event.id === eventId);
        specialDates.events[index] = { ...specialDates.events[index], ...body };
        specialDates.projectVersion = ++project.version;
        months.projectVersion = project.version;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ...specialDates.events[index], projectVersion: project.version } }) });
        return;
      }
      if (path.match(new RegExp(`/projects/${id}/special-dates/[a-f0-9-]+$`)) && route.request().method() === 'DELETE') {
        const eventId = path.split('/').at(-1)!;
        specialDates.events = specialDates.events.filter(event => event.id !== eventId);
        specialDates.projectVersion = ++project.version;
        months.projectVersion = project.version;
        await route.fulfill({ status: 204, headers: { ETag: `"${project.version}"` } });
        return;
      }
      const data = path.endsWith('/auth/session')
        ? { data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } }
        : path.endsWith(`/projects/${id}/months`) ? { data: months }
          : path.endsWith(`/projects/${id}/special-dates`) ? { data: specialDates }
          : path.endsWith(`/projects/${id}`) ? { data: project }
            : path.endsWith('/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ? { data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', category: 'IMAGE', status: 'READY', verifiedBytes: 100, contentPath: '/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/content' } }
            : { error: { code: 'NOT_FOUND' } };
      await route.fulfill({ status: path.endsWith('/auth/session') || path.endsWith(`/projects/${id}`) || path.endsWith(`/projects/${id}/months`) || path.endsWith(`/projects/${id}/special-dates`) || path.endsWith('/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ? 200 : 404,
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
    await page.getByRole('textbox', { name: locale === 'en' ? 'Date' : 'Ngày' }).fill('2027-12-24');
    await page.getByLabel(locale === 'en' ? 'Title' : 'Tiêu đề').fill('Family gathering');
    await page.getByRole('button', { name: locale === 'en' ? 'Save Special Date' : 'Lưu ngày đặc biệt' }).click();
    await expect(page.getByRole('heading', { name: 'Family gathering' })).toBeVisible();
    await expect(page.getByText(locale === 'en' ? 'Special Date added.' : 'Đã thêm ngày đặc biệt.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Family gathering' })).toBeVisible();
    const eventArticle = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Family gathering' }) });
    await eventArticle.getByRole('button', { name: locale === 'en' ? 'Edit' : 'Sửa' }).click();
    await page.getByLabel(locale === 'en' ? 'Title' : 'Tiêu đề').fill('Family celebration');
    await page.getByRole('button', { name: locale === 'en' ? 'Save changes' : 'Lưu thay đổi' }).click();
    await expect(page.getByRole('heading', { name: 'Family celebration' })).toBeVisible();
    const editedArticle = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Family celebration' }) });
    await editedArticle.getByRole('button', { name: locale === 'en' ? 'Delete' : 'Xóa' }).click();
    await page.getByRole('dialog').getByRole('button', { name: locale === 'en' ? 'Delete date' : 'Xóa ngày' }).click();
    await expect(page.getByRole('heading', { name: 'Family celebration' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel(locale === 'en' ? /Month message/ : /Lời nhắn cho tháng/)).toHaveValue('A saved Studio message');
    await expect(page.getByRole('img', { name: 'Family in the garden' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

// P06: one owner journey for the two explicit dialogs — stale-version review
// before a style save may resume, and the leave guard over unsaved content.
test('P06 reviews a stale style version before saving again and asks before leaving unsaved changes', async ({ page }) => {
  const project = createProject();
  const months = createMonths();
  const specialDates = { projectVersion: 2, events: [] as { id: string; date: string; title: string; note: string | null }[] };
  let patchAttempts = 0;
  const ifMatch: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/content')) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
      return;
    }
    if (path.endsWith(`/projects/${id}`) && request.method() === 'PATCH') {
      patchAttempts += 1;
      ifMatch.push(request.headers()['if-match'] ?? '');
      if (patchAttempts === 1) {
        // A second owner session commits version 3 while this tab still holds version 2.
        project.version += 1;
        months.projectVersion = project.version;
        specialDates.projectVersion = project.version;
        await route.fulfill({ status: 412, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'VERSION_CONFLICT', currentVersion: project.version } }) });
        return;
      }
      const body = request.postDataJSON() as { stylePresetId: string };
      project.version += 1;
      project.stylePresetId = body.stylePresetId;
      months.projectVersion = project.version;
      specialDates.projectVersion = project.version;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: project }) });
      return;
    }
    const data = path.endsWith('/auth/session')
      ? { data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } }
      : path.endsWith(`/projects/${id}/months`) ? { data: months }
        : path.endsWith(`/projects/${id}/special-dates`) ? { data: specialDates }
          : path.endsWith(`/projects/${id}`) ? { data: project }
            : path.endsWith('/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ? { data: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', category: 'IMAGE', status: 'READY', verifiedBytes: 100, contentPath: '/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/content' } }
              : { error: { code: 'NOT_FOUND' } };
    const known = path.endsWith('/auth/session') || path.endsWith(`/projects/${id}`) || path.endsWith(`/projects/${id}/months`)
      || path.endsWith(`/projects/${id}/special-dates`) || path.endsWith('/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    await route.fulfill({ status: known ? 200 : 404, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(`/projects/${id}/studio`);
  const preset = page.getByLabel('Style preset');
  await expect(preset.locator('option')).toHaveText(['Classic', 'Minimal']);

  // AC3: the stale save refreshes the saved data, tells the server version and
  // holds saving until the owner has reviewed it.
  await preset.selectOption('minimal');
  await page.getByRole('button', { name: 'Save style' }).click();
  const review = page.getByRole('dialog', { name: 'Review the refreshed calendar before saving again' });
  await expect(review).toBeVisible();
  await expect(review).toContainText('The server is now on saved version 3; you loaded an older one.');
  await expect(review).toContainText('Your draft was kept and was never written over the saved content.');
  await expect(page.getByText('Loaded saved version 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save style' })).toBeDisabled();
  await expect(preset).toHaveValue('minimal');
  // Escape must not dismiss the review or release the save lock (P06 review fix).
  await page.keyboard.press('Escape');
  await expect(review).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save style' })).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await review.getByRole('button', { name: 'I have reviewed — allow saving' }).click();
  await expect(review).toBeHidden();

  // AC2: the retry is the same conditional write, now against the refreshed version.
  await expect(page.getByRole('button', { name: 'Save style' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save style' }).click();
  await expect(page.getByText('Style saved.')).toBeVisible();
  await expect(page.getByText('Loaded saved version 4', { exact: true })).toBeVisible();
  expect(ifMatch).toEqual(['"2"', '"3"']);

  // G5: an unsaved month draft blocks the only in-Studio exit until answered.
  await page.getByLabel(/Month message/).fill('Unsaved e2e note');
  const back = page.getByRole('link', { name: /Back to calendar/ });
  await back.click();
  const leave = page.getByRole('dialog', { name: 'Leave with unsaved changes?' });
  await expect(leave).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/projects/${id}/studio$`));
  await leave.getByRole('button', { name: 'Stay and keep editing' }).click();
  await expect(leave).toBeHidden();
  await expect(page.getByLabel(/Month message/)).toHaveValue('Unsaved e2e note');

  // The draft belongs to January: switching months must not lose the guard.
  await page.getByRole('tab', { name: 'February' }).click();
  await expect(page.getByRole('button', { name: 'Save month' })).toBeDisabled();
  await back.click();
  await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: 'Stay and keep editing' }).click();
  await page.getByRole('tab', { name: 'January' }).click();
  await expect(page.getByLabel(/Month message/)).toHaveValue('Unsaved e2e note');

  await back.click();
  await leave.getByRole('button', { name: 'Leave anyway' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${id}$`));
});

// P07/AC1: all twelve Months keep what was saved into them across a full
// reopen, and one Ready photo is reused Month after Month without losing its
// alt text. Two language/theme states, as the task asks.
for (const [locale, theme] of [['en', 'dark'], ['vi', 'light']] as const) {
  test(`P07 saves and reopens all twelve Months with one reused photo: ${locale}/${theme}`, async ({ page, baseURL }) => {
    const project = createProject();
    const months = createMonths();
    const specialDates = { projectVersion: 2, events: [] as { id: string; date: string; title: string; note: string | null }[] };
    const copy = studioCopy[locale];
    const asset = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const captions = Array.from({ length: 12 }, (_, index) => `P07 note ${index + 1}`);
    await page.context().addCookies([
      { name: 'lumical_locale', value: locale, url: baseURL! },
      { name: 'lumical_theme', value: theme, url: baseURL! },
    ]);
    await page.route('**/api/v1/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const reply = (payload: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
      if (path.endsWith(`/media/${asset}/content`)) {
        await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
        return;
      }
      // Every Month has its own conditional write, not only January.
      const replaced = path.match(new RegExp(`^/api/v1/projects/${id}/months/(\\d+)$`));
      if (replaced && request.method() === 'PUT') {
        const monthNumber = Number(replaced[1]);
        const body = request.postDataJSON() as { caption: string | null; images: { assetId: string; altText: string; crop: null }[] };
        months.projectVersion += 1;
        project.version += 1;
        specialDates.projectVersion = project.version;
        months.months[monthNumber - 1] = { monthNumber, ...body };
        await reply({ data: { monthNumber, ...body, projectVersion: months.projectVersion } });
        return;
      }
      if (path.endsWith(`/projects/${id}/ar/config`)) return reply({ data: { config: null, projectVersion: project.version } });
      if (path.endsWith('/auth/session')) return reply({ data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } });
      if (path.endsWith(`/projects/${id}/months`)) return reply({ data: months });
      if (path.endsWith(`/projects/${id}/special-dates`)) return reply({ data: specialDates });
      if (path.endsWith(`/projects/${id}`)) return reply({ data: project });
      if (path.endsWith(`/media/${asset}`)) return reply({ data: { id: asset, category: 'IMAGE', status: 'READY', verifiedBytes: 100, contentPath: `/api/v1/media/${asset}/content` } });
      await reply({ error: { code: 'NOT_FOUND' } }, 404);
    });

    await page.goto(`/projects/${id}/studio`);
    const tablist = page.getByRole('tablist');
    await expect(tablist.getByRole('tab')).toHaveCount(12);
    const caption = page.getByLabel(new RegExp(copy.editor.caption));
    const save = page.getByRole('button', { name: copy.editor.save, exact: true });
    const reuse = page.getByRole('button', { name: copy.editor.chooseImage(1), exact: true });
    // The shared photo must be Ready before the first Month can adopt it.
    await expect(reuse).toBeVisible();

    for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
      await tablist.getByRole('tab', { name: copy.monthNames[monthNumber - 1], exact: true }).click();
      await caption.fill(captions[monthNumber - 1]);
      // February already holds the photo; every other Month adopts that same one.
      if (await reuse.count()) await reuse.click();
      await page.getByLabel(copy.editor.altText(1)).fill(`Reused garden photo ${monthNumber}`);
      await save.click();
      await expect(page.getByText(copy.editor.saved, { exact: true })).toBeVisible();
    }

    // One photo really is shared by all twelve Months, not copied twelve times.
    expect(months.months.every(month => month.images.length === 1)).toBe(true);
    expect(new Set(months.months.flatMap(month => month.images.map(image => image.assetId))).size).toBe(1);
    expect(months.months.map(month => month.caption)).toEqual(captions);

    await page.reload();
    await expect(page.getByText(copy.savedVersion(14), { exact: true })).toBeVisible();
    for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
      const monthName = copy.monthNames[monthNumber - 1];
      await tablist.getByRole('tab', { name: monthName, exact: true }).click();
      await expect(caption).toHaveValue(captions[monthNumber - 1]);
      const paper = page.getByRole('article', { name: `${copy.previewLabel}: ${monthName} ${project.year}`, exact: true });
      await expect(paper.getByText(captions[monthNumber - 1], { exact: true })).toBeVisible();
      await expect(page.getByRole('img', { name: `Reused garden photo ${monthNumber}`, exact: true })).toBeVisible();
    }
  });
}

// AC3: safe failures. A Month answer from an older saved version is announced
// and locks editing instead of writing over data the owner never saw, and a
// transient 503 keeps the chosen preset so the same conditional write retries.
test('P07 announces a version mismatch and retries a style save after a transient 503', async ({ page }) => {
  const project = createProject();
  const months = createMonths();
  const specialDates = { projectVersion: 2, events: [] as { id: string; date: string; title: string; note: string | null }[] };
  let servingStaleMonths = true;
  let styleAttempts = 0;
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const reply = (payload: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
    if (path.endsWith(`/projects/${id}`) && request.method() === 'PATCH') {
      styleAttempts += 1;
      if (styleAttempts === 1) return reply({ error: { code: 'PROVIDER_UNAVAILABLE', messageKey: 'errors.unavailable',
        requestId: 'req-p07', retryable: true, fieldErrors: [] } }, 503);
      const body = request.postDataJSON() as { stylePresetId: string };
      project.version += 1;
      project.stylePresetId = body.stylePresetId;
      months.projectVersion = project.version;
      specialDates.projectVersion = project.version;
      return reply({ data: project });
    }
    if (path.endsWith(`/projects/${id}/ar/config`)) return reply({ data: { config: null, projectVersion: project.version } });
    if (path.endsWith('/auth/session')) return reply({ data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } });
    if (path.endsWith(`/projects/${id}/months`)) return reply({ data: { ...months,
      projectVersion: servingStaleMonths ? months.projectVersion - 1 : months.projectVersion } });
    if (path.endsWith(`/projects/${id}/special-dates`)) return reply({ data: specialDates });
    if (path.endsWith(`/projects/${id}`)) return reply({ data: project });
    await reply({ error: { code: 'NOT_FOUND' } }, 404);
  });

  await page.goto(`/projects/${id}/studio`);
  const mismatchWarning = page.getByRole('alert').filter({ hasText: 'different saved versions' });
  await expect(mismatchWarning).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save month' })).toBeDisabled();

  servingStaleMonths = false;
  await page.reload();
  await expect(page.getByText('Loaded saved version 2', { exact: true })).toBeVisible();
  await expect(mismatchWarning).toHaveCount(0);

  await page.getByLabel('Style preset').selectOption('minimal');
  await page.getByRole('button', { name: 'Save style' }).click();
  await expect(page.getByText('Could not save the style. Your choice is still here; you can retry.')).toBeVisible();
  await expect(page.getByLabel('Style preset')).toHaveValue('minimal');
  await expect(page.getByRole('button', { name: 'Save style' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save style' }).click();
  await expect(page.getByText('Style saved.')).toBeVisible();
  await expect(page.getByText('Loaded saved version 3', { exact: true })).toBeVisible();
  expect(styleAttempts).toBe(2);
});

// T01: a signed-in second owner opening someone else's Project gets the same
// safe unavailable state as a missing one — no title, Month or version leaks.
test('P07 shows a foreign Project as unavailable without leaking its content', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
        authenticated: true,
        principal: { id: '22222222-2222-4222-8222-222222222222', email: 'other@example.test', role: 'USER', accountStatus: 'ACTIVE' },
        csrfToken: 'c'.repeat(64) } }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND' } }) });
  });
  await page.goto(`/projects/${id}/studio`);
  await expect(page.getByText('This calendar is unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic family calendar')).toHaveCount(0);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  // The unavailable state itself has no h1 yet (reported as a P02 shell defect in
  // the P07 report), so axe is asserted on the Studio shell, not this state.
});

// T21: the Studio keeps a visible keyboard focus ring, reflows at 320px with
// doubled text size and honours reduced motion. This is real text resizing, not
// a claim of browser-toolbar zoom; screen-reader passes stay with I15/I16.
test('P07 keeps Studio focus visible and reflows at 320px with 200% text under reduced motion', async ({ page }) => {
  const project = createProject();
  const months = createMonths();
  const specialDates = { projectVersion: 2, events: [] as { id: string; date: string; title: string; note: string | null }[] };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/auth/session')
      ? { data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } }
      : path.endsWith(`/projects/${id}/months`) ? { data: months }
        : path.endsWith(`/projects/${id}/special-dates`) ? { data: specialDates }
          : path.endsWith(`/projects/${id}/ar/config`) ? { data: { config: null, projectVersion: project.version } }
            : path.endsWith(`/projects/${id}`) ? { data: project }
              : { error: { code: 'NOT_FOUND' } };
    await route.fulfill({ status: 'error' in data ? 404 : 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/projects/${id}/studio`);
  const tablist = page.getByRole('tablist');
  await expect(tablist.getByRole('tab')).toHaveCount(12);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.evaluate(() => document.fonts.ready);
  const january = tablist.getByRole('tab').first();
  await january.focus();
  await expect(january).toBeFocused();
  await expect(january).toHaveCSS('outline-style', 'solid');
  // The shared motion tokens collapse under prefers-reduced-motion: reduce.
  expect(['0s', '0ms']).toContain(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-standard').trim()));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
});
