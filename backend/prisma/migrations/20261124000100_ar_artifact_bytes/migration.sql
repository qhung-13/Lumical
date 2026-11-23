BEGIN;
ALTER TABLE lumical.ar_target_artifacts ADD COLUMN artifact_bytes bytea;
ALTER TABLE lumical.ar_target_artifacts ADD CONSTRAINT ar_artifact_bytes_check CHECK (
  artifact_bytes IS NULL OR (
    prepared_at IS NOT NULL AND artifact_reference IS NOT NULL
    AND octet_length(artifact_bytes) BETWEEN 1 AND 8388608
    AND right(artifact_reference, 64) = encode(sha256(artifact_bytes), 'hex')
  )
);
CREATE FUNCTION lumical.protect_ar_artifact_bytes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.artifact_bytes IS DISTINCT FROM NEW.artifact_bytes THEN
    RAISE EXCEPTION 'Immutable target bytes' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ar_artifact_bytes_guard BEFORE UPDATE OF artifact_bytes
ON lumical.ar_target_artifacts FOR EACH ROW EXECUTE FUNCTION lumical.protect_ar_artifact_bytes();
REVOKE ALL ON FUNCTION lumical.protect_ar_artifact_bytes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lumical.protect_ar_artifact_bytes() TO lumical_runtime;
COMMIT;
