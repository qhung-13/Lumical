BEGIN;
-- Owner removal is separate from byte readiness: historical pins stay Ready.
ALTER TABLE lumical.media_assets ADD COLUMN deleted_at timestamptz(3);
GRANT UPDATE(deleted_at) ON lumical.media_assets TO lumical_runtime;
-- A durable cleanup intent is also a tombstone. New consumers serialize on the
-- asset lock, so no reference/job can appear between revocation and provider I/O.
CREATE FUNCTION lumical.guard_media_cleanup_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE media_id uuid;
BEGIN
  media_id := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
  -- Also bump the MVCC row version: a Serializable cleanup snapshot started
  -- before a READ COMMITTED consumer commits must retry, not miss the new ref.
  UPDATE lumical.media_assets SET status=status WHERE id=media_id;
  IF EXISTS (SELECT 1 FROM lumical.media_assets WHERE id=media_id AND deleted_at IS NOT NULL) OR
    EXISTS (SELECT 1 FROM lumical.job_records WHERE kind='MEDIA_DELETE' AND object_id=media_id) THEN
    RAISE EXCEPTION 'Media cleanup already requested' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER month_media_cleanup_guard BEFORE INSERT OR UPDATE OF asset_id ON lumical.project_month_media FOR EACH ROW EXECUTE FUNCTION lumical.guard_media_cleanup_reference('asset_id');
CREATE TRIGGER ar_media_cleanup_guard BEFORE INSERT OR UPDATE OF reveal_asset_id ON lumical.project_ar_experiences FOR EACH ROW EXECUTE FUNCTION lumical.guard_media_cleanup_reference('reveal_asset_id');
CREATE TRIGGER order_media_cleanup_guard BEFORE INSERT ON lumical.order_media_references FOR EACH ROW EXECUTE FUNCTION lumical.guard_media_cleanup_reference('asset_id');

CREATE FUNCTION lumical.guard_media_cleanup_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE lumical.media_assets SET status=status WHERE id=NEW.object_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.kind='MEDIA_DELETE' THEN
    IF NEW.operation_identity <> 'MEDIA_DELETE:' || NEW.object_id::text OR
      EXISTS (SELECT 1 FROM lumical.project_month_media WHERE asset_id=NEW.object_id) OR
      EXISTS (SELECT 1 FROM lumical.project_ar_experiences WHERE reveal_asset_id=NEW.object_id) OR
      EXISTS (SELECT 1 FROM lumical.order_media_references WHERE asset_id=NEW.object_id) OR
      EXISTS (SELECT 1 FROM lumical.job_records WHERE object_id=NEW.object_id AND id<>NEW.id AND kind<>'MEDIA_DELETE' AND condition NOT IN ('COMPLETED','FAILED','CANCELLED')) THEN
      RAISE EXCEPTION 'Referenced media cannot be purged' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.condition NOT IN ('COMPLETED','FAILED','CANCELLED') AND EXISTS (
    SELECT 1 FROM lumical.job_records WHERE kind='MEDIA_DELETE' AND object_id=NEW.object_id
  ) THEN
    RAISE EXCEPTION 'Media cleanup already requested' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER job_media_cleanup_guard BEFORE INSERT OR UPDATE OF object_id,kind,condition ON lumical.job_records FOR EACH ROW EXECUTE FUNCTION lumical.guard_media_cleanup_job();

CREATE FUNCTION lumical.guard_deleted_media_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'Media owner removal is irreversible' USING ERRCODE='23514';
  END IF;
  IF NEW.status<>'UNAVAILABLE' AND EXISTS (SELECT 1 FROM lumical.job_records WHERE kind='MEDIA_DELETE' AND object_id=NEW.id) THEN
    RAISE EXCEPTION 'Deleted media cannot become available' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER deleted_media_status_guard BEFORE UPDATE OF status,deleted_at ON lumical.media_assets FOR EACH ROW EXECUTE FUNCTION lumical.guard_deleted_media_status();
CREATE INDEX job_records_object_kind_idx ON lumical.job_records(object_id,kind);
REVOKE ALL ON FUNCTION lumical.guard_media_cleanup_reference(),lumical.guard_media_cleanup_job(),lumical.guard_deleted_media_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lumical.guard_media_cleanup_reference(),lumical.guard_media_cleanup_job(),lumical.guard_deleted_media_status() TO lumical_runtime;
COMMIT;
