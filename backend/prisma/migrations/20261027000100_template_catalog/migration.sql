BEGIN;

-- Expand phase: allow an operator to map existing catalog rows explicitly
-- between this migration and the enforcement migration. No business default.
ALTER TABLE lumical.templates ADD COLUMN category lumical.media_category;
COMMIT;
