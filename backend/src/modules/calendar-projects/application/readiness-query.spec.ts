import { ActiveAccounts, Clock } from '../../identity/application/ports';
import type { ActiveAccountPrincipal } from '../../identity/domain/identity';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import type { OwnerMediaRepository } from '../../media/application/owner-media';
import { CreateProject } from './create-project';
import { ProjectOwnerService } from './project-owner';
import { ProjectRepository, type ProjectRecord } from './project-repository';
import { ReadinessRepository } from './readiness-repository';

const actor: ActiveAccountPrincipal = {
  kind: 'account',
  id: 'owner',
  role: 'USER',
  accountStatus: 'ACTIVE',
};
const project = {
  id: 'project',
  ownerId: actor.id,
  version: 3,
  status: 'WORKING',
  title: 'Memories',
  recipientName: 'Family',
  year: 2000,
  stylePresetId: 'classic', baselineNameVi: 'Mẫu', baselineNameEn: 'Design',
  baselineStyle: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 },
  createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-02T00:00:00.000Z'),
} as ProjectRecord;

function setup() {
  const contexts: TransactionContext[] = [];
  const auth = jest.fn(
    async (
      _request: unknown,
      _mutation: boolean,
      work: (
        actor: ActiveAccountPrincipal,
        context: TransactionContext,
      ) => Promise<unknown>,
    ) => {
      const context = { scope: Symbol('test-transaction') };
      contexts.push(context);
      return work(actor, context);
    },
  );
  const find = jest.fn().mockResolvedValue(project);
  const months = jest.fn().mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1, caption: null, images: [] })));
  const specialDates = jest.fn().mockResolvedValue([]);
  const read = jest
    .fn()
    .mockResolvedValue({
      project,
      months: Array.from({ length: 12 }, (_, i) => ({
        monthNumber: i + 1,
        images: [],
      })),
      ar: null,
      review: null,
    });
  const service = new ProjectOwnerService(
    { withActiveAccount: auth } as unknown as ActiveAccounts,
    {} as Clock,
    { find, months, specialDates } as unknown as ProjectRepository,
    {} as CreateProject,
    {} as OwnerMediaRepository,
    { read } as ReadinessRepository,
  );
  return { auth, find, months, specialDates, read, service, contexts };
}

describe('internal Project readiness query', () => {
  it('Q06: composes content and mapped readiness inside one owner transaction and one Project revision', async () => {
    const { service, auth, find, months, specialDates, read, contexts } = setup();
    const browser = { secret: 'preview-cookie' };
    const result = await service.preview(project.id, browser);
    expect(result).toMatchObject({
      projectVersion: 3,
      project: { id: 'project', version: 3, title: 'Memories', baseline: { layout: { type: 'COLLAGE' } } },
      months: { length: 12 },
      specialDates: [],
      readiness: { previewReady: true, arReady: false, finalizationContentReady: false, orderReady: false,
        issues: { preview: [], ar: ['AR_SETUP_REQUIRED'], order: ['CALENDAR_IMAGE_REQUIRED', 'AR_REQUIREMENTS_INCOMPLETE', 'PROJECT_REVIEW_REQUIRED'] } },
    });
    expect(auth).toHaveBeenCalledWith(browser, false, expect.any(Function));
    expect(find).toHaveBeenCalledWith(actor.id, project.id, contexts[0]);
    expect(months).toHaveBeenCalledWith(actor.id, project.id, contexts[0]);
    expect(specialDates).toHaveBeenCalledWith(project, contexts[0]);
    expect(read).toHaveBeenCalledWith(project, contexts[0]);
  });

  it('Q01: authenticates as read, scopes root by owner and uses the same transaction for every fact', async () => {
    const { service, auth, find, read, contexts } = setup();
    const browser = { secret: 'not-a-real-cookie' };
    expect(await service.readiness(project.id, browser)).toMatchObject({
      projectVersion: 3,
      preview: { ready: true },
      ar: { ready: false },
      finalization: { ready: false },
    });
    expect(auth).toHaveBeenCalledWith(browser, false, expect.any(Function));
    expect(find).toHaveBeenCalledWith(actor.id, project.id, contexts[0]);
    expect(read).toHaveBeenCalledWith(project, contexts[0]);
  });

  it.each(['missing', 'foreign'] as const)(
    'Q02: %s Project safely denies before reading private children',
    async () => {
      const { service, find, read } = setup();
      find.mockResolvedValue(null);
      await expect(
        service.readiness('unknown-or-foreign', {}),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(read).not.toHaveBeenCalled();
    },
  );

  it('Q03: refuses a repository scope violation as well', async () => {
    const { service, find, read } = setup();
    find.mockResolvedValue({ ...project, ownerId: 'foreign' });
    await expect(service.readiness(project.id, {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('Q04: restarts the whole authenticated snapshot on serialization failure', async () => {
    const { service, auth, find, read, contexts } = setup();
    read.mockRejectedValueOnce(
      Object.assign(new Error('synthetic serialization'), { code: 'P2034' }),
    );
    await expect(service.readiness(project.id, {})).resolves.toMatchObject({
      projectVersion: 3,
    });
    expect(auth).toHaveBeenCalledTimes(2);
    expect(contexts[0]).not.toBe(contexts[1]);
    expect(find).toHaveBeenNthCalledWith(2, actor.id, project.id, contexts[1]);
    expect(read).toHaveBeenNthCalledWith(2, project, contexts[1]);
  });

  it('Q05: bounds serialization retries and never retries ordinary failures', async () => {
    const { service, auth, read } = setup();
    read.mockRejectedValue({ code: 'P2034' });
    await expect(service.readiness(project.id, {})).rejects.toEqual({
      code: 'P2034',
    });
    expect(auth).toHaveBeenCalledTimes(3);
    auth.mockClear();
    read.mockRejectedValue(new Error('ordinary failure'));
    await expect(service.readiness(project.id, {})).rejects.toThrow(
      'ordinary failure',
    );
    expect(auth).toHaveBeenCalledTimes(1);
  });
});
