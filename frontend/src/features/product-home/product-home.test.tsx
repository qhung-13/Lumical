import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { templateCopy } from '../../i18n/templates';
import { productCopy } from '../../i18n/product';
import { ProductHome } from './product-home';

afterEach(() => vi.unstubAllGlobals());

function renderHome() {
  const client = new QueryClient();
  return render(<PreferencesProvider><QueryClientProvider client={client}><ProductHome /></QueryClientProvider></PreferencesProvider>);
}

test('keeps the start path visible while loading and when no designs are published', async () => {
  const request = vi.fn().mockResolvedValue(Response.json({ data: [], meta: { hasMore: false, nextCursor: null } }));
  vi.stubGlobal('fetch', request);
  renderHome();
  expect(screen.getByRole('status')).toHaveTextContent(templateCopy.en.loading);
  expect(screen.getByRole('link', { name: productCopy.en.browse })).toHaveAttribute('href', '/templates');
  expect(await screen.findByText(new RegExp(templateCopy.en.emptyTitle))).toBeVisible();
  expect(request).toHaveBeenCalledWith('/api/v1/templates?limit=3', expect.objectContaining({ credentials: 'same-origin' }));
});

test('retries through the typed catalog client after a failed preview request', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(Response.json({ data: [], meta: { hasMore: false, nextCursor: null } }));
  vi.stubGlobal('fetch', request);
  renderHome();
  expect(await screen.findByRole('alert')).toHaveTextContent(templateCopy.en.errorTitle);
  await userEvent.click(screen.getByRole('button', { name: templateCopy.en.retry }));
  expect(await screen.findByText(new RegExp(templateCopy.en.emptyTitle))).toBeVisible();
  expect(request).toHaveBeenCalledTimes(2);
});
