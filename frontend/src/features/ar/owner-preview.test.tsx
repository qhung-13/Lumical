import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { ProjectApiError, type ARPreview, type ProjectApi } from '../../api/projects';
import { designatedTarget, OwnerARPreview, validateReveal } from './owner-preview';
import type { Recognizer, ScannerEvent } from './recognizer';
import { ownerARCopy } from '../../i18n/owner-ar-preview';

// Deterministic adapter fixtures, NOT genuine MindAR/device evidence.
const projectId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const assetId = '33333333-3333-4333-8333-333333333333';
const artifactId = '44444444-4444-4444-8444-444444444444';
const contentPath = `/api/v1/projects/${projectId}/ar/reveal/content?projectVersion=3`;
function descriptor(category: 'IMAGE' | 'VIDEO' | 'AUDIO' = 'IMAGE'): ARPreview {
  return { projectVersion: 3, config: { monthNumber: 1, revealAssetId: assetId, readableText: 'Our saved memory', status: 'READY' },
    target: { artifactId, targetId, sourceRevision: 3, status: 'READY', available: true, contentPath: `/api/v1/projects/${projectId}/ar/targets/${targetId}/artifact?projectVersion=3` },
    reveal: { assetId, category, contentVersion: 1, status: 'READY', contentPath } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function setup(value = descriptor(), locale: 'vi' | 'en' = 'en') {
  const arPreview = vi.fn().mockResolvedValue(value);
  const arReveal = vi.fn().mockImplementation(async (_id, _version, target?: string) => ({ ...value, reveal: { ...value.reveal, contentPath: contentPath + (target ? `&targetId=${target}` : '') } }));
  const arBytes = vi.fn().mockImplementation(async (path: string) => new Blob(['bytes'], { type: path.includes('/targets/') ? 'application/octet-stream' : `${value.reveal!.category.toLowerCase()}/test` }));
  const stop = vi.fn(); let receive!: (event: ScannerEvent) => void;
  const recognizer: Recognizer = { start: vi.fn((_host, _url, callback) => { receive = callback; return stop; }) };
  const props = { actorId: 'owner', projectId, projectVersion: 3, blocked: false, preview: value,
    api: { arPreview, arReveal, arBytes } as unknown as ProjectApi, recognizer };
  const tree = () => <PreferencesProvider initial={{ locale, theme: 'light' }}><OwnerARPreview {...props} /></PreferencesProvider>;
  const view = render(tree());
  return { ...view, props, arPreview, arReveal, arBytes, recognizer, stop, event: (event: ScannerEvent) => act(() => receive(event)), rerenderProps: () => view.rerender(tree()) };
}
beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue('blob:local-test'), revokeObjectURL: vi.fn() }));
});
describe('owner preview with explicitly deterministic recognizer adapter', () => {
  it.each(['vi', 'en'] as const)('localizes the preview actions, statuses, and runtime accessibility in %s', async locale => {
    const copy = ownerARCopy[locale];
    const app = setup(descriptor(), locale);
    expect(screen.getByRole('heading', { name: copy.heading })).toBeVisible();
    expect(screen.getByText(copy.intro)).toBeVisible();
    expect(screen.getByText(copy.idle)).toBeVisible();
    expect(screen.getByLabelText(copy.camera)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.start }));
    expect(screen.getByText(copy.loading)).toBeVisible();
    await waitFor(() => expect(app.recognizer.start).toHaveBeenCalled());
    expect(app.arBytes).toHaveBeenCalledWith(`/api/v1/projects/${projectId}/ar/targets/${targetId}/artifact?projectVersion=3`, expect.any(AbortSignal));
    expect(app.recognizer.start).toHaveBeenCalledWith(expect.any(HTMLElement), 'blob:local-test', expect.any(Function), { camera: copy.camera, locale });
    app.event({ type: 'scanning' }); expect(screen.getByText(copy.scanning)).toBeVisible();
    app.event({ type: 'error', kind: 'denied' }); expect(screen.getByText(copy.denied)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: copy.fallback }));
    await screen.findByText('Our saved memory');
    expect(screen.getByRole('heading', { name: copy.readable })).toBeVisible();
    expect(screen.getByText(copy.revealed)).toBeVisible();
    fireEvent.error(app.container.querySelector('img')!);
    expect(screen.getByText(copy.mediaFailed)).toBeVisible();
    app.props.blocked = true; app.rerenderProps();
    expect(screen.getByText(copy.blocked)).toBeVisible();
    if (locale === 'vi') {
      for (const english of Object.values(ownerARCopy.en)) expect(screen.queryByText(english)).not.toBeInTheDocument();
    }
  });
  it('rejects the obsolete target route before transport or camera startup', async () => {
    const value = descriptor();
    value.target!.contentPath = `/api/v1/projects/${projectId}/ar/target/${targetId}?projectVersion=3`;
    const app = setup(value);
    fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
    await screen.findByText(ownerARCopy.en.failed);
    expect(app.arBytes).not.toHaveBeenCalled();
    expect(app.recognizer.start).not.toHaveBeenCalled();
  });
  it.each(['IMAGE', 'VIDEO', 'AUDIO'] as const)('fallback refreshes authorization, renders %s plus readable text and never claims recognition', async category => {
    const app = setup(descriptor(category));
    expect(screen.queryByText('Our saved memory')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View without camera' }));
    await screen.findByText('Our saved memory');
    expect(app.arReveal).toHaveBeenCalledWith(projectId, 3, undefined, expect.any(AbortSignal));
    expect(app.arBytes).toHaveBeenCalledWith(contentPath, expect.any(AbortSignal));
    expect(app.container.querySelector({ IMAGE: 'img', VIDEO: 'video', AUDIO: 'audio' }[category])).toBeInTheDocument();
    expect(screen.queryByText(/Target recognized/)).not.toBeInTheDocument();
    expect(app.recognizer.start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View without camera' }));
    await waitFor(() => expect(app.arReveal).toHaveBeenCalledTimes(2));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-test');
  });
  it('only actual adapter found events trigger recognized reveal; start itself never authorizes a reveal', async () => {
    const app = setup(); fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
    await waitFor(() => expect(app.recognizer.start).toHaveBeenCalled());
    expect(app.arReveal).not.toHaveBeenCalled();
    app.event({ type: 'scanning' }); expect(app.arReveal).not.toHaveBeenCalled();
    app.event({ type: 'found', index: 0 });
    await screen.findByText('Our saved memory');
    expect(app.arReveal).toHaveBeenCalledWith(projectId, 3, targetId, expect.any(AbortSignal));
    expect(app.arBytes).toHaveBeenLastCalledWith(`${contentPath}&targetId=${targetId}`, expect.any(AbortSignal));
    app.event({ type: 'lost' });
    expect(screen.queryByText('Our saved memory')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop camera' }));
    expect(app.stop).toHaveBeenCalledTimes(1);
  });
  it.each(['denied', 'unsupported'] as const)('offers actionable %s guidance, retry and same-content fallback', async kind => {
    const app = setup(); fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
    await waitFor(() => expect(app.recognizer.start).toHaveBeenCalled()); app.event({ type: 'error', kind });
    expect(screen.getByText(kind === 'denied' ? /Camera access was denied/ : /Camera scanning needs HTTPS/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start camera' })).toBeEnabled();
    expect(app.stop).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View without camera' })); await screen.findByText('Our saved memory');
    expect(app.arReveal).toHaveBeenCalledWith(projectId, 3, undefined, expect.any(AbortSignal));
  });
  it('rejects unknown indexes and ignores late adapter events after stop', async () => {
    const app = setup(); fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
    await waitFor(() => expect(app.recognizer.start).toHaveBeenCalled()); app.event({ type: 'found', index: 1 });
    expect(app.arReveal).not.toHaveBeenCalled(); expect(app.stop).toHaveBeenCalled();
    app.event({ type: 'found', index: 0 }); expect(app.arReveal).not.toHaveBeenCalled();
  });
  it('rejects stale and unrelated recognition responses before content fetch', async () => {
    const app = setup(); app.arReveal.mockResolvedValue({ ...descriptor(), projectVersion: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'View without camera' })); await screen.findByText(/The preview could not load/);
    expect(app.arBytes).not.toHaveBeenCalled();
    app.arReveal.mockResolvedValue({ ...descriptor(), reveal: { ...descriptor().reveal, assetId: targetId } });
    fireEvent.click(screen.getByRole('button', { name: 'View without camera' }));
    await waitFor(() => expect(app.arReveal).toHaveBeenCalledTimes(2));
    expect(app.arBytes).not.toHaveBeenCalled();
    expect(screen.queryByText('Our saved memory')).not.toBeInTheDocument();
  });
  it('does not expose descriptor text if authorization is denied', async () => {
    const app = setup(); app.arReveal.mockRejectedValue(new Error('403'));
    fireEvent.click(screen.getByRole('button', { name: 'View without camera' })); await screen.findByText(/The preview could not load/);
    expect(screen.queryByText('Our saved memory')).not.toBeInTheDocument(); expect(app.arBytes).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 409, 412])('clears descriptor text when private bytes refuse scope with %s', async status => {
    const app = setup(); app.arBytes.mockRejectedValue(new ProjectApiError('NOT_FOUND', status));
    fireEvent.click(screen.getByRole('button', { name: 'View without camera' }));
    await screen.findByText(ownerARCopy.en.failed);
    expect(screen.queryByText('Our saved memory')).not.toBeInTheDocument();
    expect(screen.queryByText(ownerARCopy.en.revealed)).not.toBeInTheDocument();
  });
  it('keeps authorized readable text if media transport fails', async () => {
    const app = setup(); app.arBytes.mockRejectedValue(new Error('transport'));
    fireEvent.click(screen.getByRole('button', { name: 'View without camera' })); await screen.findByText('Our saved memory');
    expect(screen.getByText(/Media playback is unavailable/)).toBeVisible(); expect(app.container.querySelector('img')).toBeNull();
  });
  it('retains readable text on media playback errors', async () => {
    const app = setup(); fireEvent.click(screen.getByRole('button', { name: 'View without camera' })); await screen.findByText('Our saved memory');
    fireEvent.error(app.container.querySelector('img')!);
    expect(screen.getByText(/Media playback is unavailable/)).toBeVisible(); expect(screen.getByText('Our saved memory')).toBeVisible();
  });
  it.each(['actorId', 'projectId', 'projectVersion', 'blocked'] as const)('releases runtime/URLs and ignores late responses on %s change', async field => {
    const app = setup(); const pending = deferred<ARPreview>(); app.arReveal.mockReturnValue(pending.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); await waitFor(() => expect(app.recognizer.start).toHaveBeenCalled());
    app.event({ type: 'found', index: 0 });
    Object.assign(app.props, { [field]: field === 'projectVersion' ? 4 : field === 'blocked' ? true : 'another' }); app.rerenderProps();
    expect(app.stop).toHaveBeenCalled(); expect(URL.revokeObjectURL).toHaveBeenCalled();
    await act(async () => pending.resolve({ ...descriptor(), reveal: { ...descriptor().reveal!, contentPath: `${contentPath}&targetId=${targetId}` } }));
    expect(screen.queryByText('Our saved memory')).not.toBeInTheDocument();
    expect(app.arBytes).toHaveBeenCalledTimes(1);
  });
  it('ignores late artifact bytes after unmount without starting camera or creating a URL', async () => {
    const app = setup(); const pending = deferred<Blob>(); app.arBytes.mockReturnValue(pending.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); await waitFor(() => expect(app.arBytes).toHaveBeenCalled()); app.unmount();
    await act(async () => pending.resolve(new Blob(['target'])));
    expect(app.recognizer.start).not.toHaveBeenCalled(); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('ignores late reveal bytes after target loss', async () => {
    const app = setup(); fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); await waitFor(() => expect(app.recognizer.start).toHaveBeenCalled());
    const pending = deferred<Blob>(); app.arBytes.mockReturnValue(pending.promise); app.event({ type: 'found', index: 0 });
    await waitFor(() => expect(app.arBytes).toHaveBeenCalledTimes(2)); app.event({ type: 'lost' });
    await act(async () => pending.resolve(new Blob(['image'], { type: 'image/png' })));
    expect(screen.queryByText('Our saved memory')).not.toBeInTheDocument(); expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
  it('guards saved revision/dirty state and allows fallback when target unavailable', async () => {
    const value = descriptor(); value.target = null; value.config!.status = 'PREPARING';
    const app = setup(value); expect(screen.getByRole('button', { name: 'Start camera' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'View without camera' })); await screen.findByText('Our saved memory');
    app.props.blocked = true; app.rerenderProps();
    expect(screen.queryByText('Our saved memory')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'View without camera' })).toBeDisabled();
  });
  it('enforces designated revision and recognized response target identity', () => {
    expect(designatedTarget(descriptor(), 4, 0)).toBeUndefined(); expect(designatedTarget(descriptor(), 3, 9)).toBeUndefined();
    expect(() => validateReveal(descriptor(), 3, assetId)).toThrow();
    const stale = descriptor(); stale.target!.sourceRevision = 2; expect(designatedTarget(stale, 3, 0)).toBeUndefined();
  });
});
