-- Project identity validates normalized names in grapheme clusters.
-- PostgreSQL character counts cannot enforce that same limit.
ALTER TABLE "lumical"."calendar_projects"
    ALTER COLUMN "title" TYPE TEXT,
    ALTER COLUMN "recipient_name" TYPE TEXT;
