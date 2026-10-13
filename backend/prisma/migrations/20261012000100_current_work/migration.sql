BEGIN;
-- Generated from pinned Prisma 7.10.0; reviewed P0 scope 1/3.
-- CreateSchema
-- The bootstrap role creates this schema, owned by lumical_migration.
-- The migration role intentionally has no database-wide CREATE privilege.

-- CreateEnum
CREATE TYPE "lumical"."account_role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "lumical"."account_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "lumical"."template_availability" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "lumical"."project_status" AS ENUM ('WORKING', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "lumical"."media_category" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "lumical"."media_status" AS ENUM ('PENDING', 'READY', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "lumical"."a_r_readiness" AS ENUM ('NOT_CONFIGURED', 'PREPARING', 'READY', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "lumical"."users" (
    "id" UUID NOT NULL,
    "normalized_email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "lumical"."account_role" NOT NULL DEFAULT 'USER',
    "status" "lumical"."account_status" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_digest" TEXT NOT NULL,
    "csrf_digest" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL,
    "idle_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."templates" (
    "id" UUID NOT NULL,
    "availability" "lumical"."template_availability" NOT NULL DEFAULT 'INACTIVE',
    "current_published_revision_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."template_revisions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "name_vi" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_vi" TEXT NOT NULL,
    "description_en" TEXT NOT NULL,
    "layout_definition" JSONB NOT NULL,
    "style_presets" JSONB NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."calendar_projects" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "template_revision_id" UUID NOT NULL,
    "status" "lumical"."project_status" NOT NULL DEFAULT 'WORKING',
    "title" VARCHAR(80) NOT NULL,
    "year" SMALLINT NOT NULL,
    "recipient_name" VARCHAR(80) NOT NULL,
    "baseline_name_vi" TEXT NOT NULL,
    "baseline_name_en" TEXT NOT NULL,
    "baseline_style" JSONB NOT NULL,
    "style_preset_id" TEXT NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "calendar_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."calendar_months" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "month_number" SMALLINT NOT NULL,
    "caption" VARCHAR(300),

    CONSTRAINT "calendar_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."media_assets" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "category" "lumical"."media_category" NOT NULL,
    "status" "lumical"."media_status" NOT NULL DEFAULT 'PENDING',
    "upload_intent_id" UUID NOT NULL,
    "storage_reference" TEXT,
    "content_version" INTEGER NOT NULL DEFAULT 1,
    "verified_bytes" INTEGER,
    "duration_ms" INTEGER,
    "content_type" TEXT,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."project_month_media" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "month_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "crop" JSONB,
    "alt_text" TEXT NOT NULL,

    CONSTRAINT "project_month_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."special_dates" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "event_date" DATE NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "note" VARCHAR(300),

    CONSTRAINT "special_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."ar_target_artifacts" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "source_revision" INTEGER NOT NULL,
    "target_id" UUID NOT NULL,
    "status" "lumical"."a_r_readiness" NOT NULL DEFAULT 'PREPARING',
    "artifact_reference" TEXT,
    "adapter_metadata" JSONB,
    "prepared_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ar_target_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lumical"."project_ar_experiences" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "month_number" SMALLINT NOT NULL,
    "reveal_asset_id" UUID NOT NULL,
    "readable_text" TEXT NOT NULL,
    "source_revision" INTEGER NOT NULL,
    "preparation_status" "lumical"."a_r_readiness" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "target_artifact_id" UUID,

    CONSTRAINT "project_ar_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "lumical"."users"("normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_digest_key" ON "lumical"."sessions"("session_digest");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "lumical"."sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_absolute_expires_at_idx" ON "lumical"."sessions"("absolute_expires_at");

-- CreateIndex
CREATE INDEX "templates_availability_idx" ON "lumical"."templates"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "template_revisions_template_id_revision_key" ON "lumical"."template_revisions"("template_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "template_revisions_id_template_id_key" ON "lumical"."template_revisions"("id", "template_id");

-- CreateIndex
CREATE INDEX "calendar_projects_owner_id_status_updated_at_id_idx" ON "lumical"."calendar_projects"("owner_id", "status", "updated_at", "id");

-- CreateIndex
CREATE INDEX "calendar_projects_template_revision_id_idx" ON "lumical"."calendar_projects"("template_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_projects_id_owner_id_key" ON "lumical"."calendar_projects"("id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_months_project_id_month_number_key" ON "lumical"."calendar_months"("project_id", "month_number");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_months_id_project_id_key" ON "lumical"."calendar_months"("id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_upload_intent_id_key" ON "lumical"."media_assets"("upload_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_reference_key" ON "lumical"."media_assets"("storage_reference");

-- CreateIndex
CREATE INDEX "media_assets_owner_id_status_created_at_id_idx" ON "lumical"."media_assets"("owner_id", "status", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_id_owner_id_key" ON "lumical"."media_assets"("id", "owner_id");

-- CreateIndex
CREATE INDEX "project_month_media_project_id_owner_id_idx" ON "lumical"."project_month_media"("project_id", "owner_id");

-- CreateIndex
CREATE INDEX "project_month_media_asset_id_owner_id_idx" ON "lumical"."project_month_media"("asset_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_month_media_month_id_position_key" ON "lumical"."project_month_media"("month_id", "position");

-- CreateIndex
CREATE INDEX "special_dates_project_id_event_date_id_idx" ON "lumical"."special_dates"("project_id", "event_date", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ar_target_artifacts_target_id_key" ON "lumical"."ar_target_artifacts"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "ar_target_artifacts_artifact_reference_key" ON "lumical"."ar_target_artifacts"("artifact_reference");

-- CreateIndex
CREATE INDEX "ar_target_artifacts_project_id_source_revision_idx" ON "lumical"."ar_target_artifacts"("project_id", "source_revision");

-- CreateIndex
CREATE UNIQUE INDEX "ar_target_artifacts_id_project_id_owner_id_key" ON "lumical"."ar_target_artifacts"("id", "project_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_ar_experiences_project_id_key" ON "lumical"."project_ar_experiences"("project_id");

-- CreateIndex
CREATE INDEX "project_ar_experiences_reveal_asset_id_owner_id_idx" ON "lumical"."project_ar_experiences"("reveal_asset_id", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_ar_experiences_project_id_owner_id_key" ON "lumical"."project_ar_experiences"("project_id", "owner_id");

-- AddForeignKey
ALTER TABLE "lumical"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lumical"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."templates" ADD CONSTRAINT "templates_current_published_revision_id_id_fkey" FOREIGN KEY ("current_published_revision_id", "id") REFERENCES "lumical"."template_revisions"("id", "template_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."template_revisions" ADD CONSTRAINT "template_revisions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "lumical"."templates"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."calendar_projects" ADD CONSTRAINT "calendar_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "lumical"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."calendar_projects" ADD CONSTRAINT "calendar_projects_template_revision_id_fkey" FOREIGN KEY ("template_revision_id") REFERENCES "lumical"."template_revisions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."calendar_months" ADD CONSTRAINT "calendar_months_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "lumical"."calendar_projects"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."media_assets" ADD CONSTRAINT "media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "lumical"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."project_month_media" ADD CONSTRAINT "project_month_media_project_id_owner_id_fkey" FOREIGN KEY ("project_id", "owner_id") REFERENCES "lumical"."calendar_projects"("id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."project_month_media" ADD CONSTRAINT "project_month_media_month_id_project_id_fkey" FOREIGN KEY ("month_id", "project_id") REFERENCES "lumical"."calendar_months"("id", "project_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."project_month_media" ADD CONSTRAINT "project_month_media_asset_id_owner_id_fkey" FOREIGN KEY ("asset_id", "owner_id") REFERENCES "lumical"."media_assets"("id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."special_dates" ADD CONSTRAINT "special_dates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "lumical"."calendar_projects"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."ar_target_artifacts" ADD CONSTRAINT "ar_target_artifacts_project_id_owner_id_fkey" FOREIGN KEY ("project_id", "owner_id") REFERENCES "lumical"."calendar_projects"("id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."project_ar_experiences" ADD CONSTRAINT "project_ar_experiences_project_id_owner_id_fkey" FOREIGN KEY ("project_id", "owner_id") REFERENCES "lumical"."calendar_projects"("id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."project_ar_experiences" ADD CONSTRAINT "project_ar_experiences_reveal_asset_id_owner_id_fkey" FOREIGN KEY ("reveal_asset_id", "owner_id") REFERENCES "lumical"."media_assets"("id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lumical"."project_ar_experiences" ADD CONSTRAINT "project_ar_experiences_target_artifact_id_project_id_owner_fkey" FOREIGN KEY ("target_artifact_id", "project_id", "owner_id") REFERENCES "lumical"."ar_target_artifacts"("id", "project_id", "owner_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- I01-P03: SQL-only row checks; cross-row readiness/count/permissions remain application responsibilities.
ALTER TABLE lumical.users ADD CONSTRAINT users_normalized_email_check CHECK (normalized_email = lower(btrim(normalized_email)) AND length(normalized_email)>0), ADD CONSTRAINT users_version_check CHECK (version>0 AND length(password_hash)>0);
ALTER TABLE lumical.sessions ADD CONSTRAINT sessions_binding_check CHECK (length(session_digest)>0 AND length(csrf_digest)>0 AND last_activity_at>=created_at AND absolute_expires_at>created_at AND idle_expires_at<=absolute_expires_at AND idle_expires_at>=last_activity_at);
ALTER TABLE lumical.templates ADD CONSTRAINT templates_publication_check CHECK (version>0 AND (availability<>'ACTIVE' OR current_published_revision_id IS NOT NULL));
ALTER TABLE lumical.template_revisions ADD CONSTRAINT template_revisions_price_check CHECK (revision>0 AND unit_price_minor BETWEEN 1 AND 9007199254740991 AND currency='USD'), ADD CONSTRAINT template_revisions_copy_check CHECK (length(btrim(name_vi))>0 AND length(btrim(name_en))>0);
ALTER TABLE lumical.calendar_projects ADD CONSTRAINT calendar_projects_identity_check CHECK (version>0 AND year BETWEEN 1 AND 9999 AND length(btrim(title))>0 AND length(btrim(recipient_name))>0), ADD CONSTRAINT calendar_projects_price_check CHECK (unit_price_minor BETWEEN 1 AND 9007199254740991 AND currency='USD');
ALTER TABLE lumical.calendar_months ADD CONSTRAINT calendar_months_number_check CHECK (month_number BETWEEN 1 AND 12);
ALTER TABLE lumical.project_month_media ADD CONSTRAINT project_month_media_position_check CHECK (position BETWEEN 0 AND 3);
ALTER TABLE lumical.special_dates ADD CONSTRAINT special_dates_title_check CHECK (length(btrim(title))>0);
ALTER TABLE lumical.media_assets ADD CONSTRAINT media_assets_facts_check CHECK (content_version>0 AND (verified_bytes IS NULL OR verified_bytes>=0) AND (duration_ms IS NULL OR duration_ms>=0)), ADD CONSTRAINT media_assets_ready_check CHECK (status<>'READY' OR (storage_reference IS NOT NULL AND length(storage_reference)>0 AND verified_bytes IS NOT NULL AND verified_bytes>0 AND content_type IS NOT NULL AND length(content_type)>0 AND verified_at IS NOT NULL));
ALTER TABLE lumical.ar_target_artifacts ADD CONSTRAINT ar_artifact_revision_check CHECK (source_revision>0), ADD CONSTRAINT ar_artifact_ready_check CHECK (status<>'READY' OR (artifact_reference IS NOT NULL AND length(artifact_reference)>0 AND prepared_at IS NOT NULL));
ALTER TABLE lumical.project_ar_experiences ADD CONSTRAINT project_ar_experience_check CHECK (source_revision>0 AND month_number BETWEEN 1 AND 12 AND length(btrim(readable_text))>0);
COMMIT;
