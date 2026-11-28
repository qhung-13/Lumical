BEGIN;
-- Legacy configurations have no trusted pin: require an owner resave rather
-- than infer historical content from mutable media or an unverified artifact.
ALTER TABLE lumical.project_ar_experiences ADD COLUMN reveal_content_version integer;
ALTER TABLE lumical.project_ar_experiences ADD CONSTRAINT ar_reveal_content_version_check
  CHECK (reveal_content_version IS NULL OR reveal_content_version > 0);
GRANT UPDATE(reveal_content_version) ON lumical.project_ar_experiences TO lumical_runtime;
COMMIT;
