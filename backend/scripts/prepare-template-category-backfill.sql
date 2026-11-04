-- Run with lumical_migration before db:migrate only when lumical.templates
-- already contains rows. Map every Template to a reviewed topic category.
-- Never infer a category from MediaCategory (IMAGE/VIDEO/AUDIO).
CREATE TABLE lumical.template_category_backfill (
  template_id uuid PRIMARY KEY REFERENCES lumical.templates(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('GENERAL', 'BIRTHDAY', 'ANNIVERSARY', 'HOLIDAY'))
);

-- Example after reviewing a Template:
-- INSERT INTO lumical.template_category_backfill(template_id, category)
-- VALUES ('<template-uuid>', 'BIRTHDAY');

-- Before db:migrate, this query must return no rows:
-- SELECT t.id FROM lumical.templates t
-- LEFT JOIN lumical.template_category_backfill b ON b.template_id=t.id
-- WHERE b.template_id IS NULL;
