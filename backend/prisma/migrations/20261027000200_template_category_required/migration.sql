BEGIN;

-- Enforce phase. Non-empty legacy catalogs must be explicitly classified
-- after the expand migration; never silently assign a category.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM lumical.templates WHERE category IS NULL) THEN
    RAISE EXCEPTION 'Template category backfill required: set IMAGE, VIDEO, or AUDIO on every existing Template before applying I04-P01 enforcement';
  END IF;
END $$;
ALTER TABLE lumical.templates ALTER COLUMN category SET NOT NULL;
CREATE INDEX templates_catalog_category_availability_idx
  ON lumical.templates(category, availability, id);

-- Category is assigned during creation/publication; runtime has read-only
-- access until the dedicated Admin publication slice grants a command.
GRANT SELECT ON lumical.templates, lumical.template_revisions TO lumical_runtime;

COMMIT;
