import { Inject, Injectable } from '@nestjs/common';
import { IdentityRepository } from '../application/ports';
import type { Account, AccountSession, AccountStatus } from '../domain/identity';
import { IDLE_MS, ABSOLUTE_MS } from '../domain/identity';
import { PrismaDatabase } from '../../../platform/database/infrastructure/prisma-database';
import { DatabaseAvailability } from '../../../platform/database/application/database-availability';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { Transactions, type TransactionContext } from '../../../platform/database/application/transactions';

@Injectable()
export class PrismaIdentityRepository extends IdentityRepository {
  constructor(@Inject(DatabaseAvailability) private readonly database: PrismaDatabase,
    @Inject(Transactions) private readonly transactions: PrismaTransactions) { super(); }
  private client(context: TransactionContext) { return this.transactions.clientFor(context); }
  accountByEmail(email: string, context?: TransactionContext) {
    return (context ? this.client(context) : this.database.client).user.findUnique({ where: { normalizedEmail: email } });
  }
  async lockAccount(id: string, context: TransactionContext): Promise<Account | null> {
    const rows = await this.client(context).$queryRaw<Account[]>`
      SELECT id, normalized_email AS "normalizedEmail", password_hash AS "passwordHash", role, status, version
      FROM lumical.users WHERE id = ${id}::uuid FOR UPDATE`;
    return rows[0] ?? null;
  }
  createAccount(email: string, passwordHash: string, now: Date, context: TransactionContext) {
    return this.client(context).user.create({ data: { normalizedEmail: email, passwordHash, role: 'USER', status: 'ACTIVE', createdAt: now, updatedAt: now } });
  }
  session(digest: string, context: TransactionContext) {
    return this.client(context).session.findUnique({ where: { sessionDigest: digest } });
  }
  async lockSession(id: string, context: TransactionContext): Promise<AccountSession | null> {
    const rows = await this.client(context).$queryRaw<AccountSession[]>`
      SELECT id, user_id AS "userId", csrf_digest AS "csrfDigest", last_activity_at AS "lastActivityAt",
        idle_expires_at AS "idleExpiresAt", absolute_expires_at AS "absoluteExpiresAt", revoked_at AS "revokedAt"
      FROM lumical.sessions WHERE id = ${id}::uuid FOR UPDATE`;
    return rows[0] ?? null;
  }
  async createSession(data: { userId: string; digest: string; csrfDigest: string; now: Date }, context: TransactionContext) {
    await this.client(context).session.create({ data: { userId: data.userId, sessionDigest: data.digest,
      csrfDigest: data.csrfDigest, createdAt: data.now, lastActivityAt: data.now,
      idleExpiresAt: new Date(data.now.getTime() + IDLE_MS), absoluteExpiresAt: new Date(data.now.getTime() + ABSOLUTE_MS) } });
  }
  async touchSession(id: string, now: Date, idleExpiresAt: Date, context: TransactionContext) {
    await this.client(context).session.update({ where: { id }, data: { lastActivityAt: now, idleExpiresAt } });
  }
  async revokeSession(id: string, now: Date, context: TransactionContext) {
    await this.client(context).session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
  }
  async replay(actorId: string, operation: string, key: string, context: TransactionContext) {
    const value = await this.client(context).idempotencyRecord.findUnique({ where: { actorId_operation_key: { actorId, operation, key } } });
    return value ? { requestDigest: value.requestDigest, safeResult: value.safeResult, encryptedReplay: value.encryptedReplay, replayExpiresAt: value.replayExpiresAt } : null;
  }
  async saveReplay(data: Parameters<IdentityRepository['saveReplay']>[0], context: TransactionContext) {
    await this.client(context).idempotencyRecord.create({ data: { actorId: data.actorId, operation: data.operation, key: data.key,
      requestDigest: data.requestDigest, condition: 'COMPLETED', resourceType: 'USER', resourceId: data.result.id,
      safeResult: { ...data.result }, encryptedReplay: data.encrypted ? Buffer.from(data.encrypted) : undefined,
      replayExpiresAt: data.expiresAt, createdAt: data.now } });
  }
  async changeStatus(id: string, status: AccountStatus, now: Date, restoreShares: boolean, reason: string, context: TransactionContext) {
    const client = this.client(context);
    const user = await client.user.update({ where: { id }, data: { status, version: { increment: 1 }, updatedAt: now } });
    if (status === 'DISABLED') {
      await client.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
      // Security suspension only: no recipient exchange, publication or delivery feature.
      await client.recipientShare.updateMany({ where: { status: 'ACTIVE', order: { ownerId: id } },
        data: { status: 'SUSPENDED', suspendedAt: now, version: { increment: 1 } } });
    } else if (restoreShares) {
      await client.recipientShare.updateMany({ where: { status: 'SUSPENDED', revokedAt: null, credentialDigest: { not: null },
        order: { ownerId: id, paymentSettlement_order: { isNot: null } } },
        data: { status: 'ACTIVE', restoredAt: now, restorationReason: reason, version: { increment: 1 } } });
    }
    return { id: user.id, status: user.status, version: user.version };
  }
  async audit(actorId: string, targetId: string, action: string, reason: string, requestId: string, now: Date, context: TransactionContext) {
    await this.client(context).adminAuditEvent.create({ data: { actorId, targetId, targetType: 'USER', action,
      outcome: 'SUCCEEDED', purpose: reason, correlationId: requestId, createdAt: now } });
  }
}
