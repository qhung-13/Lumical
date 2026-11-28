import { Inject, Injectable } from '@nestjs/common';
import { OwnerMedia } from '../../media/application/owner-media';
import { ProjectError } from '../domain/project';
import {
  ProjectOwnerService,
  type ProjectBrowserContext,
} from './project-owner';

@Injectable()
export class OwnerARContent {
  constructor(
    @Inject(ProjectOwnerService) private readonly projects: ProjectOwnerService,
    @Inject(OwnerMedia) private readonly media: OwnerMedia,
  ) {}

  async content(
    id: string,
    version: number,
    targetId: string | undefined,
    auth: ProjectBrowserContext,
    method: 'GET' | 'HEAD',
    range: string | undefined,
    signal: AbortSignal,
  ) {
    const resolve = () => this.projects.arReveal(id, version, targetId, auth);
    const pinned = await resolve();
    // No account/project transaction is held across provider I/O. Media keeps
    // its own immutable provider binding and active-account recheck, while this
    // guard re-establishes the project/config/version/recognized-target scope.
    return this.media.content(
      auth,
      pinned.reveal!.assetId,
      method,
      range,
      signal,
      async () => {
        const current = await resolve();
        if (
          JSON.stringify(current.config) !== JSON.stringify(pinned.config) ||
          current.reveal?.assetId !== pinned.reveal?.assetId ||
          current.reveal?.contentVersion !== pinned.reveal?.contentVersion
        )
          throw new ProjectError('NOT_FOUND');
      },
    );
  }
}
