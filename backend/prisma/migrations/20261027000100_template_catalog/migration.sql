BEGIN;

-- Template topic category is distinct from the media type of an uploaded asset.
CREATE TYPE lumical.template_category AS ENUM (
  'GENERAL',
  'BIRTHDAY',
  'ANNIVERSARY',
  'HOLIDAY'
);

-- Keep nullable during expansion so an operator can provide explicit mappings
-- for legacy Templates before the enforcement migration runs.
ALTER TABLE lumical.templates ADD COLUMN category lumical.template_category;
COMMIT;
