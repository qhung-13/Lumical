import type { TransactionContext } from '../../../platform/database/application/transactions';
import type { TemplateAdminState, TemplateAvailability, TemplateRevisionInput } from '../domain/template-admin';

export interface ReplayEvidence { requestDigest: string; safeResult: unknown }
export interface TemplateAuditInput {
  actorId: string; action: string; targetId: string; outcome: string; purpose: string; correlationId: string; now: Date;
}
export interface IdempotencyInput {
  actorId: string; operation: string; key: string; requestDigest: string; safeResult: unknown; targetId: string; now: Date;
}
export interface CreateTemplateInput { category: TemplateAdminState['category']; revision: TemplateRevisionInput; now: Date }
export interface PublishResult { revisionId: string; revision: number }

export abstract class TemplateAdminRepository {
  abstract lock(id: string, context: TransactionContext): Promise<TemplateAdminState | null>;
  abstract list(input: { state?: TemplateAvailability; after?: { createdAt: Date; id: string }; take: number },
    context: TransactionContext): Promise<TemplateAdminState[]>;
  abstract create(input: CreateTemplateInput, context: TransactionContext): Promise<{ id: string; revision: PublishResult }>;
  abstract publish(id: string, input: Omit<CreateTemplateInput, 'category'>, context: TransactionContext): Promise<PublishResult>;
  abstract setAvailability(id: string, availability: TemplateAvailability, now: Date, context: TransactionContext): Promise<void>;
  abstract audit(input: TemplateAuditInput, context: TransactionContext): Promise<void>;
  abstract replay(actorId: string, operation: string, key: string, context: TransactionContext): Promise<ReplayEvidence | null>;
  abstract saveReplay(input: IdempotencyInput, context: TransactionContext): Promise<void>;
}
