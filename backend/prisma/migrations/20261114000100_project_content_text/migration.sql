BEGIN;
-- The application limits current content in grapheme clusters, not code points.
ALTER TABLE lumical.calendar_months ALTER COLUMN caption TYPE TEXT;
ALTER TABLE lumical.special_dates ALTER COLUMN title TYPE TEXT, ALTER COLUMN note TYPE TEXT;
COMMIT;
