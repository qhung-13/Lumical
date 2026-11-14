import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaApiError, ProviderUploadError } from '../../api/media';
import { MediaUploadScreen } from './media-upload';

const { api, manager, state } = vi.hoisted(() => ({
  api: { initiate: vi.fn(), upload: vi.fn(), finalize: vi.fn(), status: vi.fn() },
  manager: { csrfToken: vi.fn(() => 'c'.repeat(64)), requestEpoch: vi.fn(() => 1), bootstrap: vi.fn(), invalidate: vi.fn(), getSnapshot: () => state },
  state: { phase: 'authenticated', mutationReady: true, principal: { id: '22222222-2222-4222-8222-222222222222', role: 'USER', accountStatus: 'ACTIVE', email: 'owner@example.test' } },
}));

vi.mock('../../api/media', async importOriginal => ({ ...(await importOriginal<typeof import('../../api/media')>()), mediaApi: () => api }));
vi.mock('../identity/provider', () => ({ useIdentity: () => ({ manager, state }) }));
vi.mock('../../design-system/foundations/preferences-provider', () => ({ usePreferences: () => ({ locale: 'en', theme: 'light' }) }));
vi.mock('../../design-system/layouts/public-shell', () => ({ PublicShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../identity/identity-screen', () => ({ IdentityScreen: () => <p>Sign in to upload personal media.</p> }));

const assetId = '11111111-1111-4111-8111-111111111111';
const intent = { assetId, upload: { url: 'https://api.cloudinary.com/v1_1/lumical/image/upload', fields: { signature: 'bounded' }, expiresAt: '2027-01-01T00:00:00.000Z' } };
const pending = { id: assetId, category: 'IMAGE', status: 'PENDING', verifiedBytes: null };
const ready = { id: assetId, category: 'IMAGE', status: 'READY', verifiedBytes: 500, contentPath: `/api/v1/media/${assetId}/content` };

function selectImage(user: ReturnType<typeof userEvent.setup>, name = 'family.jpg') {
  return user.upload(screen.getByLabelText('Choose a file'), new File(['image bytes'], name, { type: 'image/jpeg' }));
}

describe('private media upload experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    manager.requestEpoch.mockReturnValue(1);
    api.initiate.mockResolvedValue(intent);
    api.upload.mockImplementation(async (_intent, _file, _category, onProgress) => { onProgress(65); });
    api.finalize.mockResolvedValue({ status: 200, data: { id: assetId, category: 'IMAGE', status: 'READY', verifiedBytes: 500 } });
    api.status.mockResolvedValue(ready);
  });

  it('announces the labeled keyboard-operable chooser and approved limits', async () => {
    const user = userEvent.setup();
    render(<MediaUploadScreen />);
    await user.selectOptions(screen.getByLabelText('Media type'), 'IMAGE');
    expect(screen.getByLabelText('Choose a file')).toHaveAttribute('accept', expect.stringContaining('.jpg'));
    expect(screen.getByText('JPEG, PNG or WebP · up to 10 MB.')).toBeVisible();
    expect(screen.getByLabelText('Choose a file')).toBeEnabled();
  });

  it('rejects unsupported and oversized inputs before creating an intent', async () => {
    const user = userEvent.setup();
    render(<MediaUploadScreen />);
    await user.selectOptions(screen.getByLabelText('Media type'), 'IMAGE');
    await user.upload(screen.getByLabelText('Choose a file'), new File(['active'], 'script.jpg', { type: 'image/svg+xml' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a file in a supported format');
    expect(api.initiate).not.toHaveBeenCalled();
  });

  it('does not show READY after provider upload or finalize until GET status confirms it', async () => {
    const user = userEvent.setup();
    let resolveStatus!: (value: typeof ready) => void;
    api.status.mockReturnValue(new Promise(resolve => { resolveStatus = resolve; }));
    render(<MediaUploadScreen />);
    await user.selectOptions(screen.getByLabelText('Media type'), 'IMAGE');
    await selectImage(user);
    await user.click(screen.getByRole('button', { name: 'Upload file' }));
    await waitFor(() => expect(api.status).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('The file is verified and ready.')).not.toBeInTheDocument();
    resolveStatus(ready);
    expect(await screen.findByText('The file is verified and ready.')).toBeVisible();
    expect(api.finalize).toHaveBeenCalledWith(assetId, expect.any(String), expect.any(AbortSignal));
  });

  it('keeps PENDING separate and retries finalization with the same logical keys', async () => {
    const user = userEvent.setup();
    api.finalize.mockResolvedValue({ status: 202, data: { assetId, status: 'PENDING' } });
    api.status.mockResolvedValue(pending);
    render(<MediaUploadScreen />);
    await user.selectOptions(screen.getByLabelText('Media type'), 'IMAGE');
    await selectImage(user);
    await user.click(screen.getByRole('button', { name: 'Upload file' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('The file is still being checked. It is not ready yet.'), { timeout: 4000 });
    expect(screen.queryByText('The file is verified and ready.')).not.toBeInTheDocument();
    const finalizeKey = api.finalize.mock.calls[0][1];
    api.finalize.mockResolvedValue({ status: 200, data: { id: assetId, category: 'IMAGE', status: 'READY', verifiedBytes: 500 } });
    api.status.mockResolvedValue(ready);
    await user.click(screen.getByRole('button', { name: 'Retry server check' }));
    await waitFor(() => expect(screen.getByText('The file is verified and ready.')).toBeVisible());
    expect(api.finalize.mock.calls.at(-1)?.[1]).toBe(finalizeKey);
  });

  it('checks the same intent after a lost provider response and offers an explicit same-intent transfer retry when still pending', async () => {
    const user = userEvent.setup();
    api.upload.mockRejectedValueOnce(new ProviderUploadError(undefined, true)).mockResolvedValueOnce(undefined);
    api.finalize.mockResolvedValueOnce({ status: 202, data: { assetId, status: 'PENDING' } });
    api.status.mockResolvedValue(pending);
    render(<MediaUploadScreen />);
    await user.selectOptions(screen.getByLabelText('Media type'), 'IMAGE');
    await selectImage(user);
    await user.click(screen.getByRole('button', { name: 'Upload file' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('The file is still being checked. It is not ready yet.'), { timeout: 4000 });
    const firstKey = api.initiate.mock.calls[0][1];
    expect(screen.getByRole('button', { name: 'Retry file transfer' })).toBeVisible();
    expect(screen.queryByText('The file is verified and ready.')).not.toBeInTheDocument();
    api.status.mockResolvedValue(ready);
    await user.click(screen.getByRole('button', { name: 'Retry file transfer' }));
    await waitFor(() => expect(screen.getByText('The file is verified and ready.')).toBeVisible());
    expect(api.initiate.mock.calls[1][1]).toBe(firstKey);
  });

  it('explains an expired intent and starts again only after an explicit action with a new key', async () => {
    const user = userEvent.setup();
    api.initiate.mockRejectedValueOnce(new MediaApiError('CONFLICT', 409, 'errors.uploadIntentExpired'))
      .mockResolvedValueOnce(intent);
    render(<MediaUploadScreen />);
    await user.selectOptions(screen.getByLabelText('Media type'), 'IMAGE');
    await selectImage(user);
    await user.click(screen.getByRole('button', { name: 'Upload file' }));
    expect(await screen.findByText(/This upload request has expired/u)).toBeVisible();
    const oldKey = api.initiate.mock.calls[0][1];
    await user.click(screen.getByRole('button', { name: 'Start a new upload' }));
    await waitFor(() => expect(screen.getByText('The file is verified and ready.')).toBeVisible());
    expect(api.initiate).toHaveBeenCalledTimes(2);
    expect(api.initiate.mock.calls[0][0]).toEqual(api.initiate.mock.calls[1][0]);
    expect(api.initiate.mock.calls[1][1]).not.toBe(oldKey);
  });

  it('blocks rate-limited retries until the countdown elapses and reuses the same file and key', async () => {
    const user = userEvent.setup();
    render(<MediaUploadScreen />);
    await user.selectOptions(screen.getByLabelText('Media type'), 'IMAGE');
    await selectImage(user);
    vi.useFakeTimers();
    try {
      api.initiate.mockRejectedValueOnce(new MediaApiError('RATE_LIMITED', 429, 'errors.rateLimited', true, Date.now() + 2000));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Upload file' })); });
      const retry = screen.getByRole('button', { name: 'Retry upload' });
      expect(screen.getByRole('status')).toHaveTextContent('Try again in 2 seconds.');
      expect(screen.getByText(/family\.jpg/u)).toBeVisible();
      expect(retry).toBeDisabled();
      fireEvent.click(retry);
      expect(api.initiate).toHaveBeenCalledTimes(1);
      expect(api.upload).not.toHaveBeenCalled();

      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(screen.getByRole('status')).toHaveTextContent('Try again in 1 second.');
      expect(retry).toBeDisabled();
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(retry).toBeEnabled();
      expect(api.initiate).toHaveBeenCalledTimes(1);
      await act(async () => { fireEvent.click(retry); });
      expect(api.initiate.mock.calls[1].slice(0, 2)).toEqual(api.initiate.mock.calls[0].slice(0, 2));
      expect(api.upload.mock.calls[0][1]).toMatchObject({ name: 'family.jpg', size: 11 });
      expect(screen.getByText('The file is verified and ready.')).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it('inspects the same intent after cancellation without re-uploading accepted bytes', async () => {
    const user = userEvent.setup();
    api.upload.mockImplementationOnce((_intent, _file, _category, _progress, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Upload cancelled', 'AbortError')), { once: true });
    })).mockResolvedValueOnce(undefined);
    render(<MediaUploadScreen />);
    await user.selectOptions(screen.getByLabelText('Media type'), 'IMAGE');
    await selectImage(user);
    await user.click(screen.getByRole('button', { name: 'Upload file' }));
    await screen.findByText('Uploading file');
    const firstKey = api.initiate.mock.calls[0][1];
    await user.click(screen.getByRole('button', { name: 'Cancel upload' }));
    expect(await screen.findByText(/Upload paused/u)).toBeVisible();
    expect(screen.getByText(/family\.jpg/u)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry server check' }));
    await waitFor(() => expect(screen.getByText('The file is verified and ready.')).toBeVisible());
    expect(api.initiate).toHaveBeenCalledTimes(1);
    expect(api.initiate.mock.calls[0][1]).toBe(firstKey);
    expect(api.upload).toHaveBeenCalledTimes(1);
    expect(api.finalize).toHaveBeenCalledWith(assetId, expect.any(String), expect.any(AbortSignal));
  });

  it('shows UNAVAILABLE only from the backend status and lets the owner restart', async () => {
    const user = userEvent.setup();
    api.finalize.mockRejectedValue(new MediaApiError('VALIDATION_FAILED', 422, 'errors.validation'));
    api.status.mockResolvedValue({ ...ready, status: 'UNAVAILABLE', verifiedBytes: null, contentPath: undefined });
    render(<MediaUploadScreen />);
    await user.selectOptions(screen.getByLabelText('Media type'), 'IMAGE');
    await selectImage(user);
    await user.click(screen.getByRole('button', { name: 'Upload file' }));
    expect(await screen.findByText(/server could not approve this file/u)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Unavailable');
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
  });
});
