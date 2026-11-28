import { ActiveAccounts, Clock } from '../../identity/application/ports';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import type { ActiveAccountPrincipal } from '../../identity/domain/identity';
import type { OwnerMediaRepository } from '../../media/application/owner-media';
import { CreateProject } from './create-project';
import { ProjectOwnerService } from './project-owner';
import { ProjectRepository, type ARPreviewRecord } from './project-repository';
import { ReadinessRepository } from './readiness-repository';
import { ARPreviewDataDto } from '../interface/dto';

const actor = {
  kind: 'account',
  id: 'owner',
  role: 'USER',
  accountStatus: 'ACTIVE',
} as ActiveAccountPrincipal;
function setup() {
  const find = jest
    .fn()
    .mockResolvedValue({ id: 'project', ownerId: actor.id, version: 7 });
  const preview: ARPreviewRecord = {
    projectVersion: 7,
    config: {
      monthNumber: 1,
      revealAssetId: 'asset',
      readableText: 'Our memory',
      status: 'READY',
    },
    target: {
      artifactId: 'artifact',
      targetId: 'target',
      sourceRevision: 7,
      status: 'READY',
      bytes: new Uint8Array([1]),
      contentType: 'application/octet-stream',
    },
    reveal: {
      assetId: 'asset',
      category: 'IMAGE',
      status: 'READY',
      contentVersion: 2,
      contentPath:
        '/api/v1/projects/project/ar/reveal/content?projectVersion=7',
    },
  };
  const arPreview = jest.fn().mockResolvedValue(preview);
  const accounts = {
    withActiveAccount: jest.fn(
      async (
        _auth: unknown,
        _mutation: boolean,
        work: (
          actor: ActiveAccountPrincipal,
          context: TransactionContext,
        ) => Promise<unknown>,
      ) => work(actor, {} as TransactionContext),
    ),
  };
  const service = new ProjectOwnerService(
    accounts as unknown as ActiveAccounts,
    {} as Clock,
    { find, arPreview } as unknown as ProjectRepository,
    {} as CreateProject,
    {} as OwnerMediaRepository,
    {} as ReadinessRepository,
  );
  return { service, find, arPreview, accounts, preview };
}
describe('owner-only version-bound reveal resolution', () => {
  it('authorizes before looking up any target or reveal', async () => {
    const { service, find, arPreview, accounts } = setup();
    find.mockResolvedValue(null);
    await expect(
      service.arReveal('foreign', 7, 'target', {}),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(accounts.withActiveAccount).toHaveBeenCalledWith(
      {},
      false,
      expect.any(Function),
    );
    expect(find).toHaveBeenCalledWith(actor.id, 'foreign', expect.anything());
    expect(arPreview).not.toHaveBeenCalled();
  });
  it('rejects stale revisions before resolving content', async () => {
    const { service, arPreview } = setup();
    await expect(
      service.arReveal('project', 6, undefined, {}),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(arPreview).not.toHaveBeenCalled();
  });
  it('same pinned fallback remains available without artifact bytes; recognition fails closed', async () => {
    const { service, preview, arPreview } = setup();
    const recognized = await service.arReveal('project', 7, 'target', {});
    expect(recognized.reveal?.contentPath).toBe(
      preview.reveal?.contentPath + '&targetId=target',
    );
    expect(recognized.config).toEqual(preview.config);
    arPreview.mockResolvedValue({ ...preview, target: null });
    const fallback = await service.arReveal('project', 7, undefined, {});
    expect(fallback.reveal).toEqual(preview.reveal);
    await expect(
      service.arReveal('project', 7, 'target', {}),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('wrong target and unavailable binding return nothing unrelated', async () => {
    const { service, arPreview, preview } = setup();
    await expect(
      service.arReveal('project', 7, 'other', {}),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    arPreview.mockResolvedValue({
      ...preview,
      reveal: { ...preview.reveal, contentPath: null },
    });
    await expect(
      service.arReveal('project', 7, undefined, {}),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('target download checks revision and cannot serve unverified bytes', async () => {
    const { service, arPreview, preview } = setup();
    await expect(
      service.arTarget('project', 'target', {}, 6),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    arPreview.mockResolvedValue({
      ...preview,
      target: { ...preview.target, bytes: null },
    });
    await expect(
      service.arTarget('project', 'target', {}, 7),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it.each(['PREPARING', 'UNAVAILABLE'])('does not expose target bytes while preparation is %s', async status => {
    const { service, arPreview, preview } = setup();
    const unavailable: ARPreviewRecord = { ...preview, config: { ...preview.config!, status: status as 'PREPARING' | 'UNAVAILABLE' } };
    arPreview.mockResolvedValue(unavailable);
    await expect(service.arTarget('project', 'target', {}, 7)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.arReveal('project', 7, 'target', {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(ARPreviewDataDto.from(unavailable, 'project').target).toMatchObject({ available: false, contentPath: '' });
  });
  it('rejects missing, stale-source, unavailable and empty targets', async () => {
    const { service, arPreview, preview } = setup();
    for (const target of [null, { ...preview.target!, sourceRevision: 6 },
      { ...preview.target!, status: 'UNAVAILABLE' }, { ...preview.target!, bytes: new Uint8Array() }]) {
      arPreview.mockResolvedValue({ ...preview, target });
      await expect(service.arTarget('project', 'target', {}, 7)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });
  it('artifact owner check precedes private byte lookup', async () => {
    const { service, find, arPreview } = setup();
    find.mockResolvedValue(null);
    await expect(service.arTarget('foreign', 'target', {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(arPreview).not.toHaveBeenCalled();
  });
  it('serializes actual project and pinned revision, never a template literal or artifact bytes', () => {
    const { preview } = setup();
    const dto = ARPreviewDataDto.from(preview, '12345678-1234-4234-8234-123456789abc');
    expect(dto.target?.contentPath).toBe(
      '/api/v1/projects/12345678-1234-4234-8234-123456789abc/ar/targets/target/artifact?projectVersion=7',
    );
    expect(dto.target).not.toHaveProperty('bytes');
  });
});
