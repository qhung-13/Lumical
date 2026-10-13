BEGIN;
-- Generated from pinned Prisma 7.10.0; reviewed P0 scope 2/3.
-- CreateEnum
CREATE TYPE "lumical"."order_status" AS ENUM ('PLACED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "lumical"."payment_status" AS ENUM ('INITIATED', 'AWAITING_APPROVAL', 'VERIFYING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "lumical"."fulfillment_status" AS ENUM ('WAITING_FOR_PAYMENT', 'PREPARING', 'DEMO_COMPLETE', 'STOPPED');

-- CreateTable
CREATE TABLE "lumical"."checkout_intents" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "project_revision" INTEGER NOT NULL,
    "request_digest" TEXT NOT NULL,
    "canonical_request" JSONB NOT NULL,
    "released_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkout_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."orders" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "checkout_intent_id" UUID NOT NULL,
    "status" "lumical"."order_status" NOT NULL DEFAULT 'PLACED',
    "quantity" SMALLINT NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "total_minor" BIGINT NOT NULL,
    "discount_minor" BIGINT NOT NULL DEFAULT 0,
    "tax_minor" BIGINT NOT NULL DEFAULT 0,
    "shipping_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "contact_name" VARCHAR(80) NOT NULL,
    "contact_email" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."order_calendar_versions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "source_project_revision" INTEGER NOT NULL,
    "year" SMALLINT NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "dedication" VARCHAR(80) NOT NULL,
    "template_revision_id" UUID NOT NULL,
    "template_name_vi" TEXT NOT NULL,
    "template_name_en" TEXT NOT NULL,
    "style_definition" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_calendar_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."order_month_snapshots" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "month_number" SMALLINT NOT NULL,
    "caption" VARCHAR(300),
    "layout" JSONB NOT NULL,

    CONSTRAINT "order_month_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."order_special_date_snapshots" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "event_date" DATE NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "note" VARCHAR(300),

    CONSTRAINT "order_special_date_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."order_media_references" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "month_id" UUID,
    "asset_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "position" SMALLINT,
    "crop" JSONB,
    "accessible_text" TEXT NOT NULL,

    CONSTRAINT "order_media_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."order_ar_snapshots" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "target_artifact_id" UUID NOT NULL,
    "reveal_reference_id" UUID NOT NULL,
    "readable_text" TEXT NOT NULL,
    "fallback_representation" JSONB NOT NULL,

    CONSTRAINT "order_ar_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."payment_attempts" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "lumical"."payment_status" NOT NULL DEFAULT 'INITIATED',
    "provider" TEXT NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "provider_order_reference" TEXT,
    "provider_capture_reference" TEXT,
    "evidence_summary" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."payment_operations" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "provider_request_id" TEXT NOT NULL,
    "request_digest" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "result_summary" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."payment_settlements" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "capture_reference" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "evidence_summary" JSONB NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."fulfillments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "lumical"."fulfillment_status" NOT NULL DEFAULT 'WAITING_FOR_PAYMENT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."fulfillment_events" (
    "id" UUID NOT NULL,
    "fulfillment_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "previous_status" "lumical"."fulfillment_status" NOT NULL,
    "next_status" "lumical"."fulfillment_status" NOT NULL,
    "reason" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkout_intents_project_id_owner_id_idx" ON "lumical"."checkout_intents"("project_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_intents_id_owner_id_project_id_key" ON "lumical"."checkout_intents"("id", "owner_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_checkout_intent_id_key" ON "lumical"."orders"("checkout_intent_id");

-- CreateIndex
CREATE INDEX "orders_owner_id_created_at_id_idx" ON "lumical"."orders"("owner_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "orders_project_id_idx" ON "lumical"."orders"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_id_owner_id_project_id_key" ON "lumical"."orders"("id", "owner_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_checkout_intent_id_owner_id_project_id_key" ON "lumical"."orders"("checkout_intent_id", "owner_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_calendar_versions_order_id_key" ON "lumical"."order_calendar_versions"("order_id");

-- CreateIndex
CREATE INDEX "order_calendar_versions_template_revision_id_idx" ON "lumical"."order_calendar_versions"("template_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_calendar_versions_id_order_id_key" ON "lumical"."order_calendar_versions"("id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_calendar_versions_id_owner_id_project_id_key" ON "lumical"."order_calendar_versions"("id", "owner_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_calendar_versions_order_id_owner_id_project_id_key" ON "lumical"."order_calendar_versions"("order_id", "owner_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_month_snapshots_version_id_month_number_key" ON "lumical"."order_month_snapshots"("version_id", "month_number");

-- CreateIndex
CREATE UNIQUE INDEX "order_month_snapshots_id_version_id_key" ON "lumical"."order_month_snapshots"("id", "version_id");

-- CreateIndex
CREATE INDEX "order_special_date_snapshots_version_id_event_date_id_idx" ON "lumical"."order_special_date_snapshots"("version_id", "event_date", "id");

-- CreateIndex
CREATE INDEX "order_media_references_version_id_owner_id_project_id_idx" ON "lumical"."order_media_references"("version_id", "owner_id", "project_id");

-- CreateIndex
CREATE INDEX "order_media_references_month_id_version_id_idx" ON "lumical"."order_media_references"("month_id", "version_id");

-- CreateIndex
CREATE INDEX "order_media_references_asset_id_owner_id_idx" ON "lumical"."order_media_references"("asset_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_media_references_id_version_id_key" ON "lumical"."order_media_references"("id", "version_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_ar_snapshots_version_id_key" ON "lumical"."order_ar_snapshots"("version_id");

-- CreateIndex
CREATE INDEX "order_ar_snapshots_target_artifact_id_project_id_owner_id_idx" ON "lumical"."order_ar_snapshots"("target_artifact_id", "project_id", "owner_id");

-- CreateIndex
CREATE INDEX "order_ar_snapshots_reveal_reference_id_version_id_idx" ON "lumical"."order_ar_snapshots"("reveal_reference_id", "version_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_ar_snapshots_version_id_owner_id_project_id_key" ON "lumical"."order_ar_snapshots"("version_id", "owner_id", "project_id");

-- CreateIndex
CREATE INDEX "payment_attempts_order_id_created_at_id_idx" ON "lumical"."payment_attempts"("order_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_id_order_id_provider_environment_key" ON "lumical"."payment_attempts"("id", "order_id", "provider", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_environment_provider_order_refere_key" ON "lumical"."payment_attempts"("provider", "environment", "provider_order_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_operations_provider_request_id_key" ON "lumical"."payment_operations"("provider_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_operations_attempt_id_kind_key" ON "lumical"."payment_operations"("attempt_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "payment_settlements_order_id_key" ON "lumical"."payment_settlements"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_settlements_attempt_id_key" ON "lumical"."payment_settlements"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_settlements_provider_environment_capture_reference_key" ON "lumical"."payment_settlements"("provider", "environment", "capture_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_settlements_attempt_id_order_id_provider_environmen_key" ON "lumical"."payment_settlements"("attempt_id", "order_id", "provider", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillments_order_id_key" ON "lumical"."fulfillments"("order_id");

-- CreateIndex
CREATE INDEX "fulfillments_status_idx" ON "lumical"."fulfillments"("status");

-- CreateIndex
CREATE INDEX "fulfillment_events_fulfillment_id_created_at_id_idx" ON "lumical"."fulfillment_events"("fulfillment_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "fulfillment_events_actor_id_idx" ON "lumical"."fulfillment_events"("actor_id");

-- AddForeignKey
ALTER TABLE "lumical"."checkout_intents" ADD CONSTRAINT "checkout_intents_project_id_owner_id_fkey" FOREIGN KEY ("project_id", "owner_id") REFERENCES "lumical"."calendar_projects"("id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."orders" ADD CONSTRAINT "orders_project_id_owner_id_fkey" FOREIGN KEY ("project_id", "owner_id") REFERENCES "lumical"."calendar_projects"("id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."orders" ADD CONSTRAINT "orders_checkout_intent_id_owner_id_project_id_fkey" FOREIGN KEY ("checkout_intent_id", "owner_id", "project_id") REFERENCES "lumical"."checkout_intents"("id", "owner_id", "project_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."order_calendar_versions" ADD CONSTRAINT "order_calendar_versions_order_id_owner_id_project_id_fkey" FOREIGN KEY ("order_id", "owner_id", "project_id") REFERENCES "lumical"."orders"("id", "owner_id", "project_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."order_calendar_versions" ADD CONSTRAINT "order_calendar_versions_template_revision_id_fkey" FOREIGN KEY ("template_revision_id") REFERENCES "lumical"."template_revisions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."order_month_snapshots" ADD CONSTRAINT "order_month_snapshots_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "lumical"."order_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."order_special_date_snapshots" ADD CONSTRAINT "order_special_date_snapshots_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "lumical"."order_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."order_media_references" ADD CONSTRAINT "order_media_references_version_id_owner_id_project_id_fkey" FOREIGN KEY ("version_id", "owner_id", "project_id") REFERENCES "lumical"."order_calendar_versions"("id", "owner_id", "project_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."order_media_references" ADD CONSTRAINT "order_media_references_month_id_version_id_fkey" FOREIGN KEY ("month_id", "version_id") REFERENCES "lumical"."order_month_snapshots"("id", "version_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."order_media_references" ADD CONSTRAINT "order_media_references_asset_id_owner_id_fkey" FOREIGN KEY ("asset_id", "owner_id") REFERENCES "lumical"."media_assets"("id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."order_ar_snapshots" ADD CONSTRAINT "order_ar_snapshots_version_id_owner_id_project_id_fkey" FOREIGN KEY ("version_id", "owner_id", "project_id") REFERENCES "lumical"."order_calendar_versions"("id", "owner_id", "project_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."order_ar_snapshots" ADD CONSTRAINT "order_ar_snapshots_target_artifact_id_project_id_owner_id_fkey" FOREIGN KEY ("target_artifact_id", "project_id", "owner_id") REFERENCES "lumical"."ar_target_artifacts"("id", "project_id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."order_ar_snapshots" ADD CONSTRAINT "order_ar_snapshots_reveal_reference_id_version_id_fkey" FOREIGN KEY ("reveal_reference_id", "version_id") REFERENCES "lumical"."order_media_references"("id", "version_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "lumical"."orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."payment_operations" ADD CONSTRAINT "payment_operations_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "lumical"."payment_attempts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."payment_settlements" ADD CONSTRAINT "payment_settlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "lumical"."orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."payment_settlements" ADD CONSTRAINT "payment_settlements_attempt_id_order_id_provider_environme_fkey" FOREIGN KEY ("attempt_id", "order_id", "provider", "environment") REFERENCES "lumical"."payment_attempts"("id", "order_id", "provider", "environment") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."fulfillments" ADD CONSTRAINT "fulfillments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "lumical"."orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."fulfillment_events" ADD CONSTRAINT "fulfillment_events_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "lumical"."fulfillments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."fulfillment_events" ADD CONSTRAINT "fulfillment_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lumical"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- I01-P04: partial uniqueness cannot be expressed as ordinary Prisma @@unique.
CREATE UNIQUE INDEX checkout_intents_open_version_key ON lumical.checkout_intents(owner_id,project_id,project_revision) WHERE released_at IS NULL;
CREATE UNIQUE INDEX payment_attempts_one_unresolved_key ON lumical.payment_attempts(order_id) WHERE status IN ('INITIATED','AWAITING_APPROVAL','VERIFYING');
CREATE UNIQUE INDEX order_media_month_position_key ON lumical.order_media_references(month_id,position) WHERE month_id IS NOT NULL;
ALTER TABLE lumical.checkout_intents ADD CONSTRAINT checkout_intent_revision_check CHECK (project_revision>0 AND length(request_digest)>0);
ALTER TABLE lumical.orders ADD CONSTRAINT orders_money_check CHECK (quantity BETWEEN 1 AND 10 AND unit_price_minor BETWEEN 1 AND 9007199254740991 AND total_minor BETWEEN 1 AND 9007199254740991 AND total_minor=unit_price_minor*quantity AND currency='USD' AND discount_minor=0 AND tax_minor=0 AND shipping_minor=0), ADD CONSTRAINT orders_identity_check CHECK (version>0 AND length(btrim(contact_name))>0 AND length(btrim(contact_email))>0);
ALTER TABLE lumical.order_calendar_versions ADD CONSTRAINT order_calendar_version_check CHECK (source_project_revision>0 AND year BETWEEN 1 AND 9999 AND length(btrim(title))>0 AND length(btrim(dedication))>0);
ALTER TABLE lumical.order_month_snapshots ADD CONSTRAINT order_month_number_check CHECK (month_number BETWEEN 1 AND 12);
ALTER TABLE lumical.order_special_date_snapshots ADD CONSTRAINT order_date_title_check CHECK (length(btrim(title))>0);
ALTER TABLE lumical.order_media_references ADD CONSTRAINT order_media_purpose_check CHECK ((purpose='MONTH_IMAGE' AND month_id IS NOT NULL AND position IS NOT NULL AND position BETWEEN 0 AND 3) OR (purpose='AR_REVEAL' AND month_id IS NULL AND position IS NULL));
ALTER TABLE lumical.order_ar_snapshots ADD CONSTRAINT order_ar_text_check CHECK (length(btrim(readable_text))>0);
ALTER TABLE lumical.payment_attempts ADD CONSTRAINT payment_attempt_sandbox_check CHECK (environment='SANDBOX' AND length(provider)>0 AND version>0);
ALTER TABLE lumical.payment_operations ADD CONSTRAINT payment_operation_identity_check CHECK (length(kind)>0 AND length(provider_request_id)>0 AND length(request_digest)>0 AND length(condition)>0);
ALTER TABLE lumical.payment_settlements ADD CONSTRAINT payment_settlement_money_check CHECK (environment='SANDBOX' AND currency='USD' AND amount_minor BETWEEN 1 AND 9007199254740991 AND length(capture_reference)>0);
ALTER TABLE lumical.fulfillments ADD CONSTRAINT fulfillment_version_check CHECK (version>0);
ALTER TABLE lumical.fulfillment_events ADD CONSTRAINT fulfillment_event_reason_check CHECK (length(btrim(reason))>0);
COMMIT;
