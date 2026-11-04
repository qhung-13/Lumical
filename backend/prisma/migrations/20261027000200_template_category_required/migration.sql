BEGIN;

-- Apply reviewed mappings prepared before `migrate deploy`; Prisma applies all
-- pending migrations in one invocation, so there is no backfill pause between
-- the expand and enforce migrations.
DO $$
DECLARE
  has_backfill_table boolean;
  has_unmapped_templates boolean;
  has_orphan_mappings boolean;
BEGIN
  has_backfill_table := to_regclass('lumical.template_category_backfill') IS NOT NULL;
  IF has_backfill_table THEN
    EXECUTE 'SELECT EXISTS (
      SELECT 1 FROM lumical.template_category_backfill b
      LEFT JOIN lumical.templates t ON t.id = b.template_id
      WHERE t.id IS NULL
    )' INTO has_orphan_mappings;
    IF has_orphan_mappings THEN
      RAISE EXCEPTION 'Template category backfill contains IDs that do not exist in lumical.templates';
    END IF;

    EXECUTE 'UPDATE lumical.templates t
      SET category = b.category::lumical.template_category
      FROM lumical.template_category_backfill b
      WHERE b.template_id = t.id';
  END IF;

  SELECT EXISTS (SELECT 1 FROM lumical.templates WHERE category IS NULL)
    INTO has_unmapped_templates;
  IF has_unmapped_templates THEN
    RAISE EXCEPTION 'Template category mapping required before migration deploy: prepare lumical.template_category_backfill with an explicit category for every existing Template';
  END IF;
END $$;

ALTER TABLE lumical.templates ALTER COLUMN category SET NOT NULL;
CREATE INDEX templates_catalog_category_availability_idx
  ON lumical.templates(category, availability, id);
DROP TABLE IF EXISTS lumical.template_category_backfill;

-- Category is assigned during creation/publication; runtime has read-only
-- access until the dedicated Admin publication slice grants a command.
GRANT SELECT ON lumical.templates, lumical.template_revisions TO lumical_runtime;

COMMIT;
