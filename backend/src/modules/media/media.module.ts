import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { IdentityModule } from '../identity/identity.module';
import {
  UploadAuthorization,
  UploadIntake,
  UploadIntents,
} from './application/upload-intake';
import { CloudinaryUpload } from './infrastructure/cloudinary-upload';
import { PrismaUploadIntents } from './infrastructure/prisma-upload-intents';
import { UploadController } from './interface/upload.controller';
import {
  FinalizeMedia,
  MediaFinalizations,
  MediaInspection,
} from './application/finalize-media';
import { CloudinaryInspection } from './infrastructure/cloudinary-inspection';
import { PrismaMediaFinalizations } from './infrastructure/prisma-media-finalizations';
import { FinalizeController } from './interface/finalize.controller';
import {
  OwnerMedia,
  OwnerMediaRepository,
  MediaContent,
} from './application/owner-media';
import { PrismaOwnerMedia } from './infrastructure/prisma-owner-media';
import { CloudinaryContent } from './infrastructure/cloudinary-content';
import { OwnerMediaController } from './interface/owner-media.controller';
import {
  MediaCleanup,
  MediaCleanupRepository,
  MediaPurge,
} from './application/media-cleanup';
import { PrismaMediaCleanup } from './infrastructure/prisma-media-cleanup';
import { CloudinaryPurge } from './infrastructure/cloudinary-purge';
import { DeleteMediaController } from './interface/delete-media.controller';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [
    UploadController,
    FinalizeController,
    OwnerMediaController,
    DeleteMediaController,
  ],
  exports: [MediaCleanup, OwnerMediaRepository],
  providers: [
    UploadIntake,
    FinalizeMedia,
    OwnerMedia,
    MediaCleanup,
    { provide: MediaCleanupRepository, useClass: PrismaMediaCleanup },
    { provide: MediaPurge, useClass: CloudinaryPurge },
    { provide: OwnerMediaRepository, useClass: PrismaOwnerMedia },
    { provide: MediaContent, useClass: CloudinaryContent },
    { provide: MediaInspection, useClass: CloudinaryInspection },
    { provide: MediaFinalizations, useClass: PrismaMediaFinalizations },
    { provide: UploadAuthorization, useClass: CloudinaryUpload },
    { provide: UploadIntents, useClass: PrismaUploadIntents },
  ],
})
export class MediaModule {}
