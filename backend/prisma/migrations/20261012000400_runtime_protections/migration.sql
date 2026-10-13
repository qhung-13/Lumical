BEGIN;
-- I01-P05 / INV-01,05,11,14: runtime is neither table owner nor schema mutator.
-- Immutable snapshots/revisions/settlement/history have SELECT+INSERT only; no normal UPDATE/DELETE/TRUNCATE.
REVOKE ALL ON ALL TABLES IN SCHEMA lumical FROM PUBLIC, lumical_runtime;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA lumical TO lumical_runtime;
REVOKE ALL ON TABLE lumical._prisma_migrations FROM lumical_runtime;
GRANT UPDATE(password_hash,role,status,version,updated_at) ON lumical.users TO lumical_runtime;
GRANT UPDATE(last_activity_at,idle_expires_at,revoked_at), DELETE ON lumical.sessions TO lumical_runtime;
GRANT UPDATE(availability,current_published_revision_id,version,updated_at) ON lumical.templates TO lumical_runtime;
GRANT UPDATE(title,recipient_name,style_preset_id,status,version,updated_at), DELETE ON lumical.calendar_projects TO lumical_runtime;
GRANT DELETE ON lumical.calendar_months,lumical.project_month_media,lumical.special_dates,lumical.project_ar_experiences,lumical.media_assets,lumical.ar_target_artifacts TO lumical_runtime;
GRANT UPDATE(caption) ON lumical.calendar_months TO lumical_runtime;
GRANT UPDATE(asset_id,position,crop,alt_text) ON lumical.project_month_media TO lumical_runtime;
GRANT UPDATE(event_date,title,note) ON lumical.special_dates TO lumical_runtime;
GRANT UPDATE(month_number,reveal_asset_id,readable_text,source_revision,preparation_status,target_artifact_id) ON lumical.project_ar_experiences TO lumical_runtime;
GRANT UPDATE(status,storage_reference,content_version,verified_bytes,duration_ms,content_type,verified_at) ON lumical.media_assets TO lumical_runtime;
GRANT UPDATE(status,artifact_reference,adapter_metadata,prepared_at) ON lumical.ar_target_artifacts TO lumical_runtime;
GRANT UPDATE(released_at) ON lumical.checkout_intents TO lumical_runtime;
GRANT UPDATE(status,version,updated_at) ON lumical.orders TO lumical_runtime;
GRANT UPDATE(status,provider_order_reference,provider_capture_reference,evidence_summary,version,updated_at) ON lumical.payment_attempts TO lumical_runtime;
GRANT UPDATE(condition,result_summary,updated_at) ON lumical.payment_operations TO lumical_runtime;
GRANT UPDATE(status,version,updated_at) ON lumical.fulfillments TO lumical_runtime;
GRANT UPDATE(status,generation,version,credential_digest,revoked_at,suspended_at,restored_at,restoration_reason) ON lumical.recipient_shares TO lumical_runtime;
GRANT UPDATE(revoked_at), DELETE ON lumical.recipient_access_sessions TO lumical_runtime;
GRANT DELETE ON lumical.admin_content_access TO lumical_runtime;
GRANT UPDATE(condition,resource_type,resource_id,safe_result,encrypted_replay,replay_expires_at) ON lumical.idempotency_records TO lumical_runtime;
GRANT UPDATE(condition,processed_at,safe_error_code) ON lumical.provider_event_inbox TO lumical_runtime;
GRANT UPDATE(condition,attempts,due_at,lease_until,claimed_by,safe_error_code,updated_at), DELETE ON lumical.job_records TO lumical_runtime;

-- Ready content identity/facts remain immutable even if availability later becomes UNAVAILABLE.
-- A row guard is necessary here: column-level grants alone cannot distinguish Pending finalization.
CREATE FUNCTION lumical.protect_verified_media() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id OR OLD.category IS DISTINCT FROM NEW.category OR OLD.upload_intent_id IS DISTINCT FROM NEW.upload_intent_id OR
    (OLD.verified_at IS NOT NULL AND ROW(OLD.storage_reference,OLD.content_version,OLD.verified_bytes,OLD.duration_ms,OLD.content_type,OLD.verified_at)
      IS DISTINCT FROM ROW(NEW.storage_reference,NEW.content_version,NEW.verified_bytes,NEW.duration_ms,NEW.content_type,NEW.verified_at)) THEN
    RAISE EXCEPTION 'Immutable media identity or verified content' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER media_identity_and_content_guard BEFORE UPDATE ON lumical.media_assets FOR EACH ROW EXECUTE FUNCTION lumical.protect_verified_media();
CREATE FUNCTION lumical.protect_prepared_artifact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.project_id,OLD.owner_id,OLD.source_revision,OLD.target_id) IS DISTINCT FROM ROW(NEW.project_id,NEW.owner_id,NEW.source_revision,NEW.target_id) OR
    (OLD.prepared_at IS NOT NULL AND ROW(OLD.artifact_reference,OLD.adapter_metadata,OLD.prepared_at) IS DISTINCT FROM ROW(NEW.artifact_reference,NEW.adapter_metadata,NEW.prepared_at)) THEN
    RAISE EXCEPTION 'Immutable target identity or prepared artifact' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER artifact_identity_and_content_guard BEFORE UPDATE ON lumical.ar_target_artifacts FOR EACH ROW EXECUTE FUNCTION lumical.protect_prepared_artifact();
REVOKE ALL ON FUNCTION lumical.protect_verified_media(),lumical.protect_prepared_artifact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lumical.protect_verified_media(),lumical.protect_prepared_artifact() TO lumical_runtime;
COMMIT;
