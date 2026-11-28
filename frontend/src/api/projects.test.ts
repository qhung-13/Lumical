import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectApi, projectDetailOptions, projectKeys, projectListOptions, projectPreviewOptions, projectSpecialDatesOptions, ProjectApiError, type ARPreview, type Project, type ProjectPreview } from './projects';

const project: Project = { id: '11111111-1111-4111-8111-111111111111', title: 'For Mom', year: 2026, recipientName: 'Mom',
  status: 'WORKING', version: 1, stylePresetId: 'classic', baseline: { name: { vi: 'Mẫu', en: 'Design' }, layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 } },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
// Detail alone carries the captured preset list (D1-A) and deletion eligibility.
const capturedPresets = [
  { id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } },
  { id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } },
];
const detail: Project & { deletionEligible: boolean; stylePresets: typeof capturedPresets } =
  { ...project, stylePresets: capturedPresets, deletionEligible: true };
const preview: ProjectPreview = { projectVersion: 1, project: { ...project, year: 2028 }, months: Array.from({ length: 12 }, (_, index) => ({
  monthNumber: index + 1, caption: null, images: [],
})), specialDates: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2028-02-29', title: 'Birthday', note: null }],
readiness: { previewReady: true, arReady: false, orderReady: false, issues: {
  preview: [], ar: ['AR_SETUP_REQUIRED'], order: ['CALENDAR_IMAGE_REQUIRED', 'AR_REQUIREMENTS_INCOMPLETE', 'PROJECT_REVIEW_REQUIRED'],
} } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const keys: string[] = [];
afterEach(() => { keys.length = 0; });

describe('Project HTTP API and private query contract', () => {
  const targetId = '22222222-2222-4222-8222-222222222222';
  const targetPath = `/api/v1/projects/${project.id}/ar/targets/${targetId}/artifact?projectVersion=3`;
  const revealPath = `/api/v1/projects/${project.id}/ar/reveal/content?projectVersion=3`;
  const arPreview: ARPreview = { projectVersion: 3,
    config: { monthNumber: 1, revealAssetId: project.id, readableText: 'Saved message', status: 'READY' },
    target: { artifactId: project.id, targetId, sourceRevision: 3, status: 'READY', available: true, contentPath: targetPath },
    reveal: { assetId: project.id, category: 'IMAGE', contentVersion: 1, status: 'READY', contentPath: revealPath } };
  it('reads version-scoped owner reveal descriptors with and without recognized target identity', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response({ data: arPreview }));
    const api = projectApi({ csrf: () => undefined, fetcher });
    const signal = new AbortController().signal;
    expect(await api.arPreview(project.id, signal)).toEqual(arPreview);
    expect(await api.arReveal(project.id, 3, undefined, signal)).toEqual(arPreview);
    expect(await api.arReveal(project.id, 3, targetId, signal)).toEqual(arPreview);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `/api/v1/projects/${project.id}/ar/preview`, `/api/v1/projects/${project.id}/ar/reveal?projectVersion=3`,
      `/api/v1/projects/${project.id}/ar/reveal?projectVersion=3&targetId=${targetId}`,
    ]);
    for (const [, init] of fetcher.mock.calls) expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
  });
  it.each([
    { projectVersion: 0 }, { config: { ...arPreview.config, status: 'UNKNOWN' } },
    { target: { ...arPreview.target, sourceRevision: 0 } }, { target: { ...arPreview.target, sourceRevision: 1.5 } },
    { reveal: { ...arPreview.reveal, contentVersion: 0 } }, { reveal: { ...arPreview.reveal, category: 'HTML' } },
  ])('rejects malformed owner preview/reveal descriptors %j', async patch => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response({ data: { ...arPreview, ...patch } }));
    const api = projectApi({ csrf: () => undefined, fetcher });
    await expect(api.arPreview(project.id)).rejects.toMatchObject({ status: 502 });
    await expect(api.arReveal(project.id, 3)).rejects.toMatchObject({ status: 502 });
  });
  it.each([targetPath, revealPath, `${revealPath}&targetId=${targetId}`])('fetches private owner bytes without caching or redirects: %s', async path => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('private bytes', { headers: { 'Content-Type': 'application/octet-stream' } }));
    const result = await projectApi({ csrf: () => undefined, fetcher }).arBytes(path, new AbortController().signal);
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(result);
    });
    expect(text).toBe('private bytes');
    expect(fetcher).toHaveBeenCalledWith(path, expect.objectContaining({ credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal) }));
  });
  it.each([
    `https://example.test${targetPath}`, `//example.test${revealPath}`,
    `/api/v1/projects/${project.id}/ar/target/${targetId}?projectVersion=3`,
    targetPath.replace('?projectVersion=3', ''), targetPath.replace('projectVersion=3', 'projectVersion=0'),
    `${revealPath}&unexpected=1`, `/api/v1/media/${project.id}/content`,
  ])('rejects an unreviewed private content route before fetch: %s', async path => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(projectApi({ csrf: () => undefined, fetcher }).arBytes(path, new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_CONTENT_PATH', status: 502 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('refreshes unauthorized sessions and preserves owner content denial codes', async () => {
    const unauthorized = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ error: { code: 'AUTHENTICATION_REQUIRED' } }, 401));
    await expect(projectApi({ csrf: () => undefined, fetcher, unauthorized }).arBytes(targetPath, new AbortController().signal)).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
  it.each(['epoch', 'abort'])('discards owner bytes arriving after %s changes', async kind => {
    let epoch = 1; const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      if (kind === 'epoch') epoch++; else controller.abort();
      return new Response('private bytes');
    });
    await expect(projectApi({ csrf: () => undefined, fetcher, epoch: () => epoch }).arBytes(targetPath, controller.signal)).rejects.toMatchObject({ code: 'STALE_RESPONSE', status: 0 });
  });

  it('reads only the owner AR projection and sends version, CSRF and a stable intent on writes', async () => {
    const body = { monthNumber: 12, revealAssetId: project.id, readableText: 'A meaningful message' };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ data: { config: { ...body, status: 'UNAVAILABLE' }, projectVersion: 5 } }))
      .mockResolvedValueOnce(response({ data: { ...body, status: 'PREPARING', projectVersion: 6 } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = projectApi({ csrf: () => 'csrf', fetcher });
    expect(await api.ar(project.id)).toMatchObject({ config: { ...body, status: 'UNAVAILABLE' }, projectVersion: 5 });
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/projects/${project.id}/ar/config`);
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
    expect(await api.saveAR(project.id, body, 'stable-ar-intent', 5)).toMatchObject({ config: { ...body, status: 'PREPARING' }, projectVersion: 6 });
    const headers = new Headers(fetcher.mock.calls[1][1]?.headers);
    expect(headers.get('If-Match')).toBe('"5"'); expect(headers.get('Idempotency-Key')).toBe('stable-ar-intent'); expect(headers.get('X-CSRF-Token')).toBe('csrf');
    await api.deleteAR(project.id, 6);
    expect(fetcher.mock.calls[1][0]).toBe(`/api/v1/projects/${project.id}/ar`);
    expect(fetcher.mock.calls[2][0]).toBe(`/api/v1/projects/${project.id}/ar`);
    expect(new Headers(fetcher.mock.calls[2][1]?.headers).get('If-Match')).toBe('"6"');
  });
  it.each([{ monthNumber: 13 }, { revealAssetId: 'foreign-url' }, { status: 'FAKE_READY' }])('rejects malformed AR responses %j', async patch => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ data: { projectVersion: 1,
      config: { monthNumber: 1, revealAssetId: project.id, readableText: 'Message', status: 'PREPARING', ...patch } } }));
    await expect(projectApi({ csrf: () => undefined, fetcher }).ar(project.id)).rejects.toMatchObject({ status: 502 });
  });
  it.each([
    { version: 0 }, { version: -1 }, { year: 0 }, { year: 10000 },
    { createdAt: 'invalid timestamp' }, { updatedAt: 'invalid timestamp' },
  ])('rejects an invalid persisted Project boundary value %j', async invalid => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ data: { ...detail, ...invalid } }));
    await expect(projectApi({ csrf: () => undefined, fetcher }).detail(project.id))
      .rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 502 });
  });
  it.each([
    { stylePresets: 'classic' },
    { stylePresets: [{ id: '', name: { vi: 'Cổ điển', en: 'Classic' } }] },
    { stylePresets: [{ id: 'classic' }] },
    { stylePresets: [{ id: 'classic', name: { vi: '', en: 'Classic' } }] },
  ])('rejects a detail response whose captured preset list is not a curated shape %j', async invalid => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ data: { ...detail, ...invalid } }));
    await expect(projectApi({ csrf: () => undefined, fetcher }).detail(project.id))
      .rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 502 });
  });
  it('rejects an invalid root version in a twelve-Month response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ data: { projectVersion: 0,
      months: Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1, caption: null, images: [] })) } }));
    await expect(projectApi({ csrf: () => undefined, fetcher }).months(project.id))
      .rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 502 });
  });
  it('sends exactly the five generated create fields with cookie, CSRF and stable idempotency headers', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ data: project }, 201));
    const api = projectApi({ csrf: () => 'csrf-test', fetcher });
    const body = { templateId: '22222222-2222-4222-8222-222222222222', title: 'For Mom', year: 2026, recipientName: 'Mom', stylePresetId: 'classic' };
    expect(await api.create(body, 'a'.repeat(32))).toEqual(project);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('/api/v1/projects');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: {
      Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-test', 'Idempotency-Key': 'a'.repeat(32) } });
    expect(JSON.parse(String(init?.body))).toEqual(body);
    expect(Object.keys(JSON.parse(String(init?.body))).sort()).toEqual(['recipientName', 'stylePresetId', 'templateId', 'title', 'year']);
  });
  it('patches curated style with If-Match and keeps the server version named by a 412', async () => {
    const conflict = { error: { code: 'VERSION_CONFLICT', requestId: 'req-1', currentVersion: 7, retryable: false } };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ data: project }))
      .mockResolvedValueOnce(response(conflict, 412));
    const api = projectApi({ csrf: () => 'csrf-test', fetcher });
    expect(await api.patch(project.id, { stylePresetId: 'minimal' }, 3)).toEqual(project);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`/api/v1/projects/${project.id}`);
    expect(init).toMatchObject({ method: 'PATCH', headers: expect.objectContaining({
      'If-Match': '"3"', 'X-CSRF-Token': 'csrf-test', 'Content-Type': 'application/json' }) });
    expect(JSON.parse(String(init?.body))).toEqual({ stylePresetId: 'minimal' });
    // Version honesty: the 412 body's currentVersion survives to the caller.
    await expect(api.patch(project.id, { stylePresetId: 'minimal' }, 3)).rejects.toMatchObject({
      code: 'VERSION_CONFLICT', status: 412, currentVersion: 7, requestId: 'req-1' });
  });
  it('requests list pagination and detail with no-store, validates envelopes, and keeps cursor filters in actor-scoped keys', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ data: [project], meta: { nextCursor: 'next', hasMore: true } })).mockResolvedValueOnce(response({ data: detail }));
    const api = projectApi({ csrf: () => undefined, fetcher });
    expect(await api.list({ cursor: 'cursor', state: 'WORKING', limit: 5 })).toEqual({ data: [project], meta: { nextCursor: 'next', hasMore: true } });
    expect(await api.detail(project.id)).toEqual(detail);
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/projects?state=WORKING&cursor=cursor&limit=5');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' });
    expect(projectKeys.list('actor-a', { cursor: 'x' })).not.toEqual(projectKeys.list('actor-b', { cursor: 'x' }));
    expect(projectKeys.list('actor-a', { cursor: 'x' })).not.toEqual(projectKeys.list('actor-a', { cursor: 'y' }));
    expect(projectKeys.detail('actor-a', project.id)).not.toEqual(projectKeys.detail('actor-b', project.id));
    expect(projectListOptions('actor-a', { cursor: 'x' }, api).queryKey).toEqual(projectKeys.list('actor-a', { cursor: 'x' }));
    expect(projectDetailOptions('actor-a', project.id, api).queryKey).toEqual(projectKeys.detail('actor-a', project.id));
  });
  it('reads one typed saved preview revision privately and keeps its query cache actor-scoped', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ data: preview }));
    const api = projectApi({ csrf: () => undefined, fetcher });
    expect(await api.preview(project.id)).toEqual(preview);
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/projects/${project.id}/preview`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    expect(projectKeys.preview('actor-a', project.id)).not.toEqual(projectKeys.preview('actor-b', project.id));
    expect(projectPreviewOptions('actor-a', project.id, api).queryKey).toEqual(projectKeys.preview('actor-a', project.id));
  });
  it.each([
    (value: ProjectPreview) => ({ ...value, projectVersion: 2 }),
    (value: ProjectPreview) => ({ ...value, readiness: { ...value.readiness, issues: { ...value.readiness.issues, preview: ['PREVIEW_INVALID_PROJECT'] } } as unknown as ProjectPreview['readiness'] }),
    (value: ProjectPreview) => ({ ...value, months: value.months.slice(1) }),
    (value: ProjectPreview) => ({ ...value, specialDates: [{ ...value.specialDates[0], date: '2029-02-29' }] }),
    (value: ProjectPreview) => ({ ...value, months: value.months.map((month, index) => index === 0 ? { ...month, images: [{ assetId: project.id, altText: '', crop: null, contentPath: 'https://example.test/photo' }] } : month) }),
  ])('rejects malformed or non-public Preview DTOs', async mutate => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ data: mutate(preview) }));
    await expect(projectApi({ csrf: () => undefined, fetcher }).preview(project.id))
      .rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 502 });
  });
  it('reads all twelve ordered Month summaries and sends conditional lifecycle requests', async () => {
    const monthRows = Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1, caption: null, images: [] }));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ data: { projectVersion: 1, months: monthRows } }))
      .mockResolvedValueOnce(response({ data: project })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = projectApi({ csrf: () => 'csrf-test', fetcher });
    expect(await api.months(project.id)).toEqual({ projectVersion: 1, months: monthRows });
    await api.archive(project.id, 3);
    await api.remove(project.id, 3);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', headers: expect.objectContaining({ 'If-Match': '"3"', 'X-CSRF-Token': 'csrf-test' }) });
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'DELETE', headers: expect.objectContaining({ 'If-Match': '"3"', 'X-CSRF-Token': 'csrf-test' }), body: '{"confirmed":true}' });
  });
  it('replaces a Month with only approved fields and the current Project version', async () => {
    const image = { assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', altText: 'Family portrait', crop: null };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ data: {
      monthNumber: 4, caption: 'A spring memory', images: [image], projectVersion: 5,
    } }));
    const api = projectApi({ csrf: () => 'csrf-test', fetcher });
    const body = { caption: 'A spring memory', images: [image] } satisfies import('./projects').MonthPatch;
    expect(await api.updateMonth(project.id, 4, body, 4)).toEqual({
      monthNumber: 4, caption: 'A spring memory', images: [image], projectVersion: 5,
    });
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/projects/${project.id}/months/4`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'PUT', credentials: 'same-origin', cache: 'no-store',
      headers: { 'X-CSRF-Token': 'csrf-test', 'If-Match': '"4"', 'Content-Type': 'application/json' },
      body: JSON.stringify(body) });
  });
  it('keeps the backend version conflict code for stale Month writes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ error: { code: 'VERSION_CONFLICT' } }, 412));
    const api = projectApi({ csrf: () => 'csrf-test', fetcher });
    await expect(api.updateMonth(project.id, 1, { caption: null, images: [] }, 2))
      .rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 412 });
  });
  it('uses typed Special Date endpoints, required headers, actor-scoped cache keys and the empty 204 delete response', async () => {
    const event = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2024-02-29', title: 'Birthday', note: null };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ data: { events: [event], projectVersion: 4 } }))
      .mockResolvedValueOnce(response({ data: { ...event, projectVersion: 5 } }, 201))
      .mockResolvedValueOnce(response({ data: { ...event, title: 'Anniversary', projectVersion: 6 } }))
      .mockResolvedValueOnce(new Response(null, { status: 204, headers: { ETag: '"7"' } }));
    const api = projectApi({ csrf: () => 'csrf-test', fetcher });
    const body = { date: '2024-02-29', title: 'Birthday', note: null } satisfies import('./projects').SpecialDateWrite;
    expect(await api.specialDates(project.id)).toEqual({ events: [event], projectVersion: 4 });
    expect(await api.createSpecialDate(project.id, body, 'i'.repeat(36), 4)).toEqual({ ...event, projectVersion: 5 });
    expect(await api.updateSpecialDate(project.id, event.id, { ...body, title: 'Anniversary' }, 5))
      .toEqual({ ...event, title: 'Anniversary', projectVersion: 6 });
    await expect(api.deleteSpecialDate(project.id, event.id, 6)).resolves.toBeUndefined();

    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/projects/${project.id}/special-dates`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', cache: 'no-store' });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', headers: expect.objectContaining({
      'X-CSRF-Token': 'csrf-test', 'Idempotency-Key': 'i'.repeat(36), 'If-Match': '"4"', 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    expect(fetcher.mock.calls[2][0]).toBe(`/api/v1/projects/${project.id}/special-dates/${event.id}`);
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'PUT', headers: expect.objectContaining({ 'If-Match': '"5"', 'X-CSRF-Token': 'csrf-test' }) });
    expect(fetcher.mock.calls[3][1]).toMatchObject({ method: 'DELETE', headers: expect.objectContaining({ 'If-Match': '"6"', 'X-CSRF-Token': 'csrf-test' }) });
    expect(fetcher.mock.calls[3][1]?.body).toBeUndefined();
    expect(projectKeys.specialDates('actor-a', project.id)).not.toEqual(projectKeys.specialDates('actor-b', project.id));
    expect(projectSpecialDatesOptions('actor-a', project.id, api).queryKey).toEqual(projectKeys.specialDates('actor-a', project.id));
  });
  it('rejects malformed Special Date data and maps stale writes to VERSION_CONFLICT', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ data: { events: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2024-02-30', title: 'Bad', note: null }], projectVersion: 1 } }))
      .mockResolvedValueOnce(response({ error: { code: 'VERSION_CONFLICT' } }, 412));
    const api = projectApi({ csrf: () => 'csrf-test', fetcher });
    await expect(api.specialDates(project.id)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 502 });
    await expect(api.createSpecialDate(project.id, { date: '2024-02-29', title: 'Day', note: null }, 'k'.repeat(36), 1))
      .rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 412 });
  });
  it('maps safe error envelope and field errors; malformed DTOs never expose server content', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ error: { code: 'VALIDATION_FAILED', requestId: 'req-1', retryable: false,
      fieldErrors: [{ path: 'recipientName', code: 'OUT_OF_RANGE', messageKey: 'validation.projectRecipient' }] } }, 422))
      .mockResolvedValueOnce(response({ data: { secret: 'do not surface' } }));
    const api = projectApi({ csrf: () => 'csrf', fetcher });
    await expect(api.create({ templateId: project.id, title: 'X', year: 2026, recipientName: 'Y', stylePresetId: 'classic' }, 'k'.repeat(16)))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED', status: 422, requestId: 'req-1', fields: [{ path: 'recipientName', messageKey: 'validation.projectRecipient' }] });
    await expect(api.detail(project.id)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 502 });
  });
  it('rejects a response arriving after the session actor epoch changes', async () => {
    let epoch = 1;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { epoch = 2; return response({ data: project }); });
    await expect(projectApi({ csrf: () => undefined, epoch: () => epoch, fetcher }).detail(project.id))
      .rejects.toBeInstanceOf(ProjectApiError);
    const client = new QueryClient(); client.setQueryData(projectKeys.detail('actor-a', project.id), project);
    expect(client.getQueryData(projectKeys.detail('actor-b', project.id))).toBeUndefined(); client.clear();
  });
});
