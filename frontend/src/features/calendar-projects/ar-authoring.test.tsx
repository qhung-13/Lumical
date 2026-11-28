import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { ProjectApiError, projectKeys, type ARRevision, type ProjectApi } from '../../api/projects';
import { type MediaApi, type OwnedMedia } from '../../api/media';
import { ARAuthoring } from './ar-authoring';

vi.mock('../media/media-upload', () => ({ StudioRevealUpload: () => <p>Upload reveal fixture</p> }));
const assetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ready: OwnedMedia = { id: assetId, category: 'IMAGE', status: 'READY', verifiedBytes: 10, contentPath: `/api/v1/media/${assetId}/content` };

function setup(options: { category?: OwnedMedia['category']; config?: ARRevision['config']; archived?: boolean; locale?: 'vi' | 'en' } = {}) {
  let revision: ARRevision = { config: options.config ?? null, projectVersion: 3 };
  const ar = vi.fn().mockImplementation(async () => revision);
  const arPreview = vi.fn().mockImplementation(async () => ({ ...revision, target: null, reveal: null }));
  const saveAR = vi.fn().mockImplementation(async (_id, body) => {
    revision = { config: { ...body, status: 'PREPARING' }, projectVersion: 4 }; return revision;
  });
  const deleteAR = vi.fn().mockImplementation(async () => { revision = { config: null, projectVersion: 4 }; });
  const status = vi.fn().mockResolvedValue({ ...ready, category: options.category ?? 'IMAGE' });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = { actorId: 'owner', projectId: 'project', projectVersion: 3,
    projectStatus: options.archived ? 'ARCHIVED' as const : 'WORKING' as const, mutationReady: true,
    api: { ar, arPreview, saveAR, deleteAR } as unknown as ProjectApi, media: { status } as unknown as MediaApi,
    availableMedia: [{ ...ready, category: options.category ?? 'IMAGE' }], onDirtyChange: vi.fn<(dirty: boolean) => void>() };
  const tree = () => <QueryClientProvider client={client}><PreferencesProvider initial={{ locale: options.locale ?? 'en', theme: 'light' }}><ARAuthoring {...props} /></PreferencesProvider></QueryClientProvider>;
  const view = render(tree());
  return { ...view, props, ar, arPreview, saveAR, deleteAR, status, client,
    setRevision: (next: ARRevision) => { revision = next; }, rerenderProps: () => view.rerender(tree()) };
}
async function draft(label = 'Meaningful image message') {
  await screen.findByLabelText('Reveal Month');
  fireEvent.change(screen.getByLabelText('Ready reveal media'), { target: { value: assetId } });
  fireEvent.change(screen.getByLabelText(label), { target: { value: '  Our memories  ' } });
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});
describe('one owner AR reveal authoring', () => {
  it('reports preview read failures separately without claiming a save failed', async () => {
    const app = setup();
    await screen.findByLabelText('Reveal Month');
    app.arPreview.mockRejectedValue(new Error('preview unavailable'));
    await act(async () => app.client.invalidateQueries({ queryKey: projectKeys.arPreview('owner', 'project') }));
    expect(await screen.findByText(/Could not load the owner preview/)).toBeVisible();
    expect(screen.queryByText(/Your draft is preserved/)).not.toBeInTheDocument();
    expect(app.saveAR).not.toHaveBeenCalled();
    app.arPreview.mockResolvedValue({ config: null, projectVersion: 3, target: null, reveal: null });
    await userEvent.click(screen.getByRole('button', { name: 'Reload AR configuration' }));
    await waitFor(() => expect(screen.queryByText(/Could not load the owner preview/)).not.toBeInTheDocument());
  });

  it('reports dirty changes, clears an exact revert, and releases the host guard on unmount', async () => {
    const app = setup();
    await screen.findByLabelText('Reveal Month');
    expect(app.props.onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByLabelText('Reveal Month'), { target: { value: '2' } });
    expect(app.props.onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getByLabelText('Reveal Month'), { target: { value: '1' } });
    expect(app.props.onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByLabelText('Ready reveal media'), { target: { value: assetId } });
    expect(app.props.onDirtyChange).toHaveBeenLastCalledWith(true);
    app.unmount();
    expect(app.props.onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('reports an unresolved save intent as dirty even when refetch shows identical saved content, and blocks retry while unverified', async () => {
    const config = { monthNumber: 1, revealAssetId: assetId, readableText: 'Saved text', status: 'PREPARING' as const };
    const app = setup({ config });
    await screen.findByDisplayValue('Saved text');
    app.saveAR.mockRejectedValueOnce(new TypeError('lost response'));
    fireEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await screen.findByText(/Your draft is preserved/);
    expect(app.props.onDirtyChange).toHaveBeenLastCalledWith(true);
    app.setRevision({ config, projectVersion: 4 });
    await act(async () => app.client.invalidateQueries({ queryKey: projectKeys.ar('owner', 'project') }));
    app.props.projectVersion = 4; app.props.mutationReady = false; app.rerenderProps();
    expect(app.props.onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('button', { name: 'Save AR reveal' })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText('Meaningful image message').closest('form')!);
    expect(app.saveAR).toHaveBeenCalledTimes(1);
    app.props.mutationReady = true; app.rerenderProps();
    fireEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await screen.findByText('AR configuration saved.');
    expect(app.saveAR.mock.calls[1]).toEqual(app.saveAR.mock.calls[0]);
    expect(app.props.onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it.each([
    ['IMAGE', 'Meaningful image message'], ['VIDEO', 'Video caption or transcript'], ['AUDIO', 'Audio transcript or caption'],
  ] as const)('saves %s with readable text and shows genuine pending preparation', async (category, label) => {
    const app = setup({ category }); await draft(label);
    fireEvent.change(screen.getByLabelText('Reveal Month'), { target: { value: '12' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await waitFor(() => expect(app.saveAR).toHaveBeenCalledWith('project', { monthNumber: 12, revealAssetId: assetId, readableText: 'Our memories' }, expect.any(String), 3));
    expect(await screen.findByText(/PREPARING — configuration saved/)).toBeVisible();
  });
  it('requires meaningful text and rejects an asset which became unready before save', async () => {
    const app = setup(); await screen.findByLabelText('Reveal Month');
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    expect(app.saveAR).not.toHaveBeenCalled();
    await draft(); app.status.mockResolvedValue({ ...ready, status: 'PENDING' });
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    expect(await screen.findByText(/Media is unavailable, not owned/)).toBeVisible();
    expect(app.saveAR).not.toHaveBeenCalled(); expect(screen.getByLabelText('Meaningful image message')).toHaveValue('  Our memories  ');
  });
  it('rejects a category change and foreign existing media without calling save', async () => {
    const app = setup(); await draft(); app.status.mockResolvedValue({ ...ready, category: 'AUDIO' });
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await screen.findByText(/Media is unavailable, not owned/); expect(app.saveAR).not.toHaveBeenCalled();
    app.status.mockRejectedValue(new Error('404'));
    fireEvent.change(screen.getByLabelText('Use an existing media ID'), { target: { value: assetId } });
    await userEvent.click(screen.getByRole('button', { name: 'Check media' }));
    expect(app.saveAR).not.toHaveBeenCalled();
  });
  it('preserves draft and retries the exact same intent after a lost response', async () => {
    const app = setup(); app.saveAR.mockRejectedValueOnce(new TypeError('response lost')); await draft();
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await screen.findByText(/Your draft is preserved/);
    expect(screen.getByLabelText('Meaningful image message')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await waitFor(() => expect(app.saveAR).toHaveBeenCalledTimes(2));
    expect(app.saveAR.mock.calls[1]).toEqual(app.saveAR.mock.calls[0]);
  });
  it('requires explicit review after a 412 and retains local text', async () => {
    const app = setup(); app.saveAR.mockRejectedValueOnce(new ProjectApiError('VERSION_CONFLICT', 412)); await draft();
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await screen.findByRole('button', { name: /I reviewed the current/ });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save AR reveal' })).toBeDisabled());
    expect(screen.getByLabelText('Meaningful image message')).toHaveValue('  Our memories  ');
    await waitFor(() => expect(screen.getByRole('button', { name: /I reviewed the current/ })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: /I reviewed the current/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await waitFor(() => expect(app.saveAR).toHaveBeenCalledTimes(2));
    expect(app.saveAR.mock.calls[1][2]).not.toEqual(app.saveAR.mock.calls[0][2]);
  });
  it('can resolve an uncertain intent with its original version after other editors refresh the Project', async () => {
    const app = setup(); app.saveAR.mockRejectedValueOnce(new TypeError('response lost')); await draft();
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await screen.findByText(/Your draft is preserved/);
    app.props.projectVersion = 4; app.rerenderProps();
    expect(screen.getByRole('button', { name: /I reviewed the current/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await waitFor(() => expect(app.saveAR).toHaveBeenCalledTimes(2));
    expect(app.saveAR.mock.calls[1]).toEqual(app.saveAR.mock.calls[0]);
  });
  it('shows the refreshed saved Month, media and text after 412 while preserving all draft fields for explicit review', async () => {
    const app = setup(); await draft();
    fireEvent.change(screen.getByLabelText('Reveal Month'), { target: { value: '2' } });
    const remoteAsset = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const refreshed = Promise.withResolvers<ARRevision>();
    app.ar.mockImplementation(() => refreshed.promise);
    app.saveAR.mockRejectedValueOnce(new ProjectApiError('VERSION_CONFLICT', 412));
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    const review = await screen.findByRole('button', { name: /I reviewed the current/ });
    expect(review).toBeDisabled();
    await act(async () => refreshed.resolve({ config: { monthNumber: 12, revealAssetId: remoteAsset,
      readableText: 'Changed in another tab', status: 'PREPARING' }, projectVersion: 4 }));
    app.props.projectVersion = 4; app.rerenderProps();
    const saved = within(await screen.findByRole('region', { name: 'Current saved configuration' }));
    expect(saved.getByText('Saved Month').nextElementSibling).toHaveTextContent('December');
    expect(saved.getByText('Saved media ID').nextElementSibling).toHaveTextContent(remoteAsset);
    expect(saved.getByText('Saved readable text').nextElementSibling).toHaveTextContent('Changed in another tab');
    expect(screen.getByLabelText('Reveal Month')).toHaveValue('2');
    expect(screen.getByLabelText('Ready reveal media')).toHaveValue(assetId);
    expect(screen.getByLabelText('Meaningful image message')).toHaveValue('  Our memories  ');
    expect(screen.getByRole('button', { name: 'Save AR reveal' })).toBeDisabled();
    expect(app.saveAR).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(review).toBeEnabled());
    await userEvent.click(review);
    await userEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await waitFor(() => expect(app.saveAR).toHaveBeenCalledTimes(2));
    expect(app.saveAR.mock.calls[1]).toEqual(['project', { monthNumber: 2, revealAssetId: assetId,
      readableText: 'Our memories' }, expect.any(String), 4]);
  });
  it('reopens unavailable configuration, explains historical retention and confirms removal', async () => {
    const app = setup({ config: { monthNumber: 4, revealAssetId: assetId, readableText: 'Saved message', status: 'UNAVAILABLE' } });
    expect(await screen.findByDisplayValue('Saved message')).toBeVisible();
    expect(screen.getByText(/UNAVAILABLE —/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Remove current AR reveal' }));
    expect(screen.getByText(/Previously ordered versions and their media remain unchanged/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(app.deleteAR).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove current AR reveal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove configuration' }));
    await waitFor(() => expect(app.deleteAR).toHaveBeenCalledWith('project', 3));
  });
  it('localizes saved owner preview and media category without English status placeholders', async () => {
    setup({ locale: 'vi', config: { monthNumber: 1, revealAssetId: assetId, readableText: 'Kỷ niệm đã lưu', status: 'READY' } });
    await screen.findByDisplayValue('Kỷ niệm đã lưu');
    expect(await screen.findByRole('heading', { name: 'Xem trước của chủ sở hữu' })).toBeVisible();
    expect(await screen.findByRole('option', { name: `Ảnh · ${assetId}` })).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái mục tiêu: Sẵn sàng/)).toBeVisible();
    expect(screen.queryByText(/Owner preview|Fallback:|No readable reveal text saved|READY|PREPARING|UNAVAILABLE/)).not.toBeInTheDocument();
  });
  it('locks archived projects and supports Vietnamese', async () => {
    setup({ archived: true, locale: 'vi' });
    expect(await screen.findByLabelText('Tháng có AR')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lưu nội dung AR' })).toBeDisabled();
  });
  it('keeps a draft bound to its original version until the user reviews current content', async () => {
    const app = setup(); await draft(); app.props.projectVersion = 4; app.rerenderProps();
    expect(screen.getByRole('button', { name: 'Save AR reveal' })).toBeDisabled();
    expect(screen.getByLabelText('Meaningful image message')).toHaveValue('  Our memories  ');
  });
});
