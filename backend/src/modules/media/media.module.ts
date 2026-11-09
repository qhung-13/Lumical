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

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [UploadController],
  providers: [
    UploadIntake,
    { provide: UploadAuthorization, useClass: CloudinaryUpload },
    { provide: UploadIntents, useClass: PrismaUploadIntents },
  ],
})
export class MediaModule {}
