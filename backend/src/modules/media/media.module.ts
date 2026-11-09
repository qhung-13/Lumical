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

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [UploadController, FinalizeController, OwnerMediaController],
  providers: [
    UploadIntake,
    FinalizeMedia,
    OwnerMedia,
    { provide: OwnerMediaRepository, useClass: PrismaOwnerMedia },
    { provide: MediaContent, useClass: CloudinaryContent },
    { provide: MediaInspection, useClass: CloudinaryInspection },
    { provide: MediaFinalizations, useClass: PrismaMediaFinalizations },
    { provide: UploadAuthorization, useClass: CloudinaryUpload },
    { provide: UploadIntents, useClass: PrismaUploadIntents },
  ],
})
export class MediaModule {}
