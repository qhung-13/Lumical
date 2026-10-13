BEGIN;
-- Generated from pinned Prisma 7.10.0; reviewed P0 scope 3/3.
-- CreateEnum
CREATE TYPE "lumical"."share_status" AS ENUM ('ACTIVE', 'REVOKED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "lumical"."recipient_shares" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "lumical"."share_status" NOT NULL DEFAULT 'ACTIVE',
    "generation" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "credential_digest" TEXT,
    "revoked_at" TIMESTAMPTZ(3),
    "suspended_at" TIMESTAMPTZ(3),
    "restored_at" TIMESTAMPTZ(3),
    "restoration_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipient_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."recipient_access_sessions" (
    "id" UUID NOT NULL,
    "share_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_version_id" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "lease_digest" TEXT NOT NULL,
    "csrf_digest" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipient_access_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."admin_content_access" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_content_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."admin_audit_events" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "inspection_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "outcome" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."idempotency_records" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_digest" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" UUID,
    "safe_result" JSONB,
    "encrypted_replay" BYTEA,
    "replay_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."provider_event_inbox" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "event_id" TEXT NOT NULL,
    "evidence_summary" JSONB NOT NULL,
    "condition" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "safe_error_code" TEXT,

    CONSTRAINT "provider_event_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."job_records" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "object_id" UUID NOT NULL,
    "operation_identity" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "lease_until" TIMESTAMPTZ(3),
    "claimed_by" UUID,
    "safe_error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipient_shares_order_id_key" ON "lumical"."recipient_shares"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_shares_credential_digest_key" ON "lumical"."recipient_shares"("credential_digest");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_shares_id_order_id_key" ON "lumical"."recipient_shares"("id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_access_sessions_lease_digest_key" ON "lumical"."recipient_access_sessions"("lease_digest");

-- CreateIndex
CREATE INDEX "recipient_access_sessions_share_id_generation_idx" ON "lumical"."recipient_access_sessions"("share_id", "generation");

-- CreateIndex
CREATE INDEX "recipient_access_sessions_order_version_id_order_id_idx" ON "lumical"."recipient_access_sessions"("order_version_id", "order_id");

-- CreateIndex
CREATE INDEX "recipient_access_sessions_expires_at_idx" ON "lumical"."recipient_access_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "admin_content_access_admin_id_order_id_expires_at_idx" ON "lumical"."admin_content_access"("admin_id", "order_id", "expires_at");

-- CreateIndex
CREATE INDEX "admin_content_access_order_id_idx" ON "lumical"."admin_content_access"("order_id");

-- CreateIndex
CREATE INDEX "admin_audit_events_actor_id_created_at_id_idx" ON "lumical"."admin_audit_events"("actor_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "admin_audit_events_target_type_target_id_created_at_id_idx" ON "lumical"."admin_audit_events"("target_type", "target_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "admin_audit_events_inspection_id_idx" ON "lumical"."admin_audit_events"("inspection_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_id_operation_key_key" ON "lumical"."idempotency_records"("actor_id", "operation", "key");

-- CreateIndex
CREATE INDEX "provider_event_inbox_condition_received_at_id_idx" ON "lumical"."provider_event_inbox"("condition", "received_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_event_inbox_provider_environment_event_id_key" ON "lumical"."provider_event_inbox"("provider", "environment", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_records_operation_identity_key" ON "lumical"."job_records"("operation_identity");

-- CreateIndex
CREATE INDEX "job_records_condition_due_at_id_idx" ON "lumical"."job_records"("condition", "due_at", "id");

-- AddForeignKey
ALTER TABLE "lumical"."recipient_shares" ADD CONSTRAINT "recipient_shares_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "lumical"."orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."recipient_access_sessions" ADD CONSTRAINT "recipient_access_sessions_share_id_order_id_fkey" FOREIGN KEY ("share_id", "order_id") REFERENCES "lumical"."recipient_shares"("id", "order_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."recipient_access_sessions" ADD CONSTRAINT "recipient_access_sessions_order_version_id_order_id_fkey" FOREIGN KEY ("order_version_id", "order_id") REFERENCES "lumical"."order_calendar_versions"("id", "order_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."admin_content_access" ADD CONSTRAINT "admin_content_access_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "lumical"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."admin_content_access" ADD CONSTRAINT "admin_content_access_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "lumical"."orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lumical"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."admin_audit_events" ADD CONSTRAINT "admin_audit_events_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "lumical"."admin_content_access"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."idempotency_records" ADD CONSTRAINT "idempotency_records_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lumical"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- I01-P05: generation is captured on a lease; do NOT FK it to the mutable current generation.
-- Rotation must remain possible while old leases exist. I11 checks equality on every request.
ALTER TABLE lumical.recipient_shares ADD CONSTRAINT recipient_share_generation_check CHECK (generation>0 AND version>0), ADD CONSTRAINT recipient_share_digest_check CHECK ((status='REVOKED' AND credential_digest IS NULL) OR (status IN ('ACTIVE','SUSPENDED') AND credential_digest IS NOT NULL AND length(credential_digest)>0));
ALTER TABLE lumical.recipient_access_sessions ADD CONSTRAINT recipient_lease_binding_check CHECK (generation>0 AND length(lease_digest)>0 AND length(csrf_digest)>0 AND expires_at>created_at AND expires_at<=created_at+interval '24 hours');
ALTER TABLE lumical.admin_content_access ADD CONSTRAINT admin_inspection_scope_check CHECK (purpose IN ('ORDER_SUPPORT','DEMO_FULFILLMENT') AND length(btrim(reason))>0 AND expires_at>created_at AND expires_at<=created_at+interval '15 minutes');
ALTER TABLE lumical.admin_audit_events ADD CONSTRAINT admin_audit_safe_identity_check CHECK (length(action)>0 AND length(target_type)>0 AND length(outcome)>0 AND length(btrim(purpose))>0);
ALTER TABLE lumical.idempotency_records ADD CONSTRAINT idempotency_identity_check CHECK (length(operation)>0 AND length(key)>0 AND length(request_digest)>0 AND length(condition)>0), ADD CONSTRAINT idempotency_encrypted_replay_check CHECK ((encrypted_replay IS NULL AND replay_expires_at IS NULL) OR (encrypted_replay IS NOT NULL AND octet_length(encrypted_replay)>0 AND replay_expires_at IS NOT NULL AND replay_expires_at>created_at AND replay_expires_at<=created_at+interval '24 hours'));
ALTER TABLE lumical.provider_event_inbox ADD CONSTRAINT provider_inbox_identity_check CHECK (environment='SANDBOX' AND length(provider)>0 AND length(event_id)>0 AND length(condition)>0);
ALTER TABLE lumical.job_records ADD CONSTRAINT job_intent_check CHECK (attempts>=0 AND length(kind)>0 AND length(condition)>0 AND length(operation_identity)>0 AND ((lease_until IS NULL AND claimed_by IS NULL) OR (lease_until IS NOT NULL AND claimed_by IS NOT NULL)));
COMMIT;
