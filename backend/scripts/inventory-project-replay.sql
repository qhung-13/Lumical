-- I05 D02: read-only aggregate inventory, NOT a migration or remediation.
-- An authorized operator must select an explicitly permitted database first.
-- No key, digest, safe_result body, actor ID, title, cookie or credential is output.
-- Scan every PROJECT_CREATE record: a Git timestamp is not a deployment cutoff.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

SELECT current_database() AS database_name,
       current_user AS inventory_role,
       transaction_timestamp() AS inventory_at,
       current_setting('transaction_read_only') AS transaction_read_only;

SELECT count(*) AS total_records,
       count(*) FILTER (WHERE safe_result IS NULL) AS sql_null_records,
       count(*) FILTER (WHERE jsonb_typeof(safe_result) = 'null') AS json_null_records,
       count(*) FILTER (WHERE jsonb_typeof(safe_result) = 'object') AS object_records,
       count(*) FILTER (WHERE safe_result IS NOT NULL AND jsonb_typeof(safe_result) NOT IN ('object', 'null')) AS other_payload_records,
       count(*) FILTER (WHERE condition <> 'COMPLETED') AS non_completed_records,
       min(created_at) AS first_record_at,
       max(created_at) AS last_record_at
FROM lumical.idempotency_records
WHERE operation = 'PROJECT_CREATE';

SELECT r.condition,
       r.resource_type,
       CASE WHEN r.safe_result IS NULL THEN 'SQL_NULL'
            WHEN jsonb_typeof(r.safe_result) = 'null' THEN 'JSON_NULL'
            WHEN jsonb_typeof(r.safe_result) = 'object' THEN 'OBJECT_REQUIRES_APPLICATION_VALIDATION'
            ELSE 'OTHER_JSON_TYPE' END AS payload_class,
       CASE WHEN r.resource_id IS NULL THEN 'NO_RESOURCE_ID'
            WHEN p.id IS NULL THEN 'ROOT_MISSING_OR_DELETED'
            WHEN p.owner_id <> r.actor_id THEN 'OWNER_MISMATCH'
            WHEN p.version = 1 THEN 'ROOT_VERSION_ONE_NOT_PROOF_OF_ORIGINAL_OUTCOME'
            ELSE 'ROOT_CHANGED' END AS resource_class,
       count(*) AS record_count
FROM lumical.idempotency_records r
LEFT JOIN lumical.calendar_projects p ON p.id = r.resource_id
WHERE r.operation = 'PROJECT_CREATE'
GROUP BY r.condition, r.resource_type, payload_class, resource_class
ORDER BY r.condition, r.resource_type, payload_class, resource_class;

-- An object is NOT automatically a valid original ProjectView. Validate its
-- provenance/shape through the approved application contract before Case B.
-- A missing root is normal after authorized deletion and does not authorize recreation.
ROLLBACK;
