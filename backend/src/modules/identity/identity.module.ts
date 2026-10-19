import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { ActiveAccounts, AuthAttempts, Clock, IdentityPolicy, IdentityRepository, PasswordHash, Secrets } from './application/ports';
import { IdentityService } from './application/identity-service';
import { IdentityController } from './interface/identity.controller';
import { IdentityConfig } from './infrastructure/identity-config';
import { PrismaIdentityRepository } from './infrastructure/prisma-identity-repository';
import { AuthAbuseProtection, IdentitySecrets, ScryptPasswordHash, SystemClock } from './infrastructure/security';

@Module({ imports: [DatabaseModule], controllers: [IdentityController],
  providers: [IdentityService, IdentityConfig, IdentitySecrets, AuthAbuseProtection,
    { provide: IdentityPolicy, useExisting: IdentityConfig }, { provide: Secrets, useExisting: IdentitySecrets },
    { provide: ActiveAccounts, useExisting: IdentityService },
    { provide: AuthAttempts, useExisting: AuthAbuseProtection }, { provide: Clock, useClass: SystemClock },
    { provide: PasswordHash, useClass: ScryptPasswordHash }, { provide: IdentityRepository, useClass: PrismaIdentityRepository }],
  exports: [ActiveAccounts, IdentityPolicy] })
export class IdentityModule {}
