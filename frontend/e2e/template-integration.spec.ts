import { expect, test, type Page } from '@playwright/test';
import { templateCopy } from '../src/i18n/templates';

async function writeRevision(page: Page, englishName: string, price: string) {
  await page.getByLabel(/^Name — Vietnamese/).fill('Thiết kế kiểm thử');
  await page.getByLabel(/^Name — English/).fill(englishName);
  await page.getByLabel(/^Description — Vietnamese/).fill('Mô tả dùng cho kiểm thử');
  await page.getByLabel(/^Description — English/).fill('Synthetic calendar for integration');
  await page.getByRole('checkbox', { name: 'Classic' }).check();
  await page.getByLabel(/^Base unit price/).fill(price);
  await page.getByTestId('review-submit').click();
  await page.getByTestId('review-confirm').click();
}

async function changeAvailability(page: Page, target: 'active' | 'inactive') {
  await page.getByTestId(`availability-${target}`).click();
  await page.getByLabel(/^Reason \(required\)/).fill('Synthetic catalog verification');
  await page.getByTestId('availability-confirm').click();
  await expect(page.getByTestId('command-notice')).toContainText(target === 'active' ? 'Availability set to Active.' : 'Availability set to Inactive.');
  await page.keyboard.press('Escape');
}

test('real Admin writes publish one revision across response loss and drive public discovery', async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  const login = await page.request.post('/api/v1/auth/login', {
    headers: { Origin: baseURL! },
    data: { email: 'operator@example.invalid', password: '  TEST ONLY memory passphrase  ' },
  });
  expect(login.status()).toBe(200);
  await page.context().addCookies([{ name: 'lumical_locale', value: 'en', url: baseURL! }]);
  await page.goto('/admin/templates/new');
  await page.getByRole('radio', { name: 'Birthday' }).check();
  await writeRevision(page, 'Live integration original', '24.00');
  await expect(page).toHaveURL(/\/admin\/templates\/[0-9a-f-]{36}$/);
  const templateId = new URL(page.url()).pathname.split('/').at(-1)!;
  await expect(page.getByText('Inactive', { exact: true })).toBeVisible();
  expect((await page.request.get(`/api/v1/templates/${templateId}`)).status()).toBe(404);

  // Forward the first publish to the real backend and drop only its response.
  const attempts: { key: string; version: string; status: number }[] = [];
  await page.route(`**/api/v1/admin/templates/${templateId}/revisions`, async route => {
    const response = await route.fetch();
    const headers = route.request().headers();
    attempts.push({ key: headers['idempotency-key'], version: headers['if-match'], status: response.status() });
    if (attempts.length === 1) await route.abort();
    else await route.fulfill({ response });
  });
  await writeRevision(page, 'Live integration published', '25.99');
  await expect(page.getByTestId('command-notice')).toContainText('unavailable');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('v2', { exact: true })).toBeVisible();
  await page.getByTestId('review-submit').click();
  await page.getByTestId('review-confirm').click();
  await expect(page.getByTestId('command-notice')).toContainText('Revision 2 published.');
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toMatchObject({ version: '"1"', status: 201 });
  expect(attempts[1]).toEqual(attempts[0]);
  await changeAvailability(page, 'active');
  await expect(page.getByText('v3', { exact: true })).toBeVisible();

  const guest = await browser.newPage({ baseURL });
  try {
    await guest.context().addCookies([{ name: 'lumical_locale', value: 'en', url: baseURL! }]);
    await guest.goto('/templates');
    const copy = templateCopy.en;
    const design = guest.getByRole('link', { name: `${copy.open}: Live integration published` });
    await expect(design).toBeVisible();
    await guest.getByLabel(copy.category).selectOption('HOLIDAY');
    await expect(guest.getByRole('heading', { name: 'Spring calendar', exact: true }).first()).toBeVisible();
    await expect(design).toHaveCount(0);
    await guest.getByLabel(copy.category).selectOption('BIRTHDAY');
    await guest.getByLabel(copy.search).fill('live integration published');
    await guest.getByRole('button', { name: copy.searchAction }).click();
    await expect(design).toBeVisible();
    await design.click();
    await expect(guest.getByRole('heading', { level: 1, name: 'Live integration published' })).toBeVisible();
    await expect(guest.getByText('Published design · Revision 2')).toBeVisible();
    for (const value of ['Classic', 'Photo focus', '$25.99']) await expect(guest.getByText(value, { exact: true })).toBeVisible();

    const firstPage = await guest.request.get('/api/v1/templates?category=HOLIDAY&limit=1');
    expect(firstPage.status()).toBe(200);
    const first = await firstPage.json();
    expect(first.meta.hasMore).toBe(true);
    expect(first.meta.nextCursor).toBeTruthy();
    const nextPage = await guest.request.get(`/api/v1/templates?category=HOLIDAY&limit=1&cursor=${encodeURIComponent(first.meta.nextCursor)}`);
    expect(nextPage.status()).toBe(200);
    const next = await nextPage.json();
    expect(next.data).toHaveLength(1);
    expect(next.data[0].id).not.toBe(first.data[0].id);

    await changeAvailability(page, 'inactive');
    const unavailable = await guest.request.get(`/api/v1/templates/${templateId}`);
    expect(unavailable.status()).toBe(404);
    expect((await unavailable.json()).error.code).toBe('NOT_FOUND');
    await guest.reload();
    await expect(guest.getByRole('heading', { name: copy.notFound })).toBeVisible();
    await guest.goto('/templates');
    await guest.getByLabel(copy.category).selectOption('BIRTHDAY');
    await guest.getByLabel(copy.search).fill('live integration published');
    await guest.getByRole('button', { name: copy.searchAction }).click();
    await expect(guest.getByRole('heading', { name: copy.noResultsTitle })).toBeVisible();
    await expect(design).toHaveCount(0);

    const member = await guest.request.post('/api/v1/auth/login', {
      headers: { Origin: baseURL! },
      data: { email: 'member@example.invalid', password: '  TEST ONLY memory passphrase  ' },
    });
    expect(member.status()).toBe(200);
    expect((await guest.request.get('/api/v1/admin/templates')).status()).toBe(403);
  } finally {
    await guest.close();
  }
});
