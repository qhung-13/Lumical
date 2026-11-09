# Cloudinary private adapter contract (I06-P01)

Implementation contract for P02-P04; P02 registers upload intake and P03 registers finalization.
Authority: ARCHITECTURE section 11, BR-MED-001..006, API_CONTRACT media rows.
LEAD security review remains pending; this document does not constitute approval.

- Upload: backend generates a unique immutable key per owner/asset/intent, authenticated delivery type,
  overwrite=false, finite short expiry and category byte/format restrictions. Bind owner, asset and
  intent in backend-controlled provider metadata. Never accept a caller-provided remote URL or key.
  Only exact configured HTTPS Cloudinary upload origin/account/path may leave the backend.
  Signing algorithm, expiry enforcement and account settings must be verified against official
  provider documentation in P02; timestamp alone must not be assumed to enforce a short lifetime.
- Inspect/finalize: use authenticated provider API, not browser response facts. Match exact key,
  immutable provider version, binding, resource type, actual MIME/format, bytes, duration and private
  original/derivative protection. Cloudinary audio uses provider resource mechanics translated to
  AUDIO; those mechanics never become domain categories. Only verified safe facts reach policy.
  Missing/in-progress object maps to PENDING; timeout/auth/config uncertainty maps to UNAVAILABLE.
  Object mismatch maps to REJECTED/BINDING_MISMATCH; unsafe content to INVALID_CONTENT; immutable
  collision to CONFLICT. No raw SDK errors, credentials or signed URLs escape the adapter.
- Fetch: application rechecks active owner or current version/grant/reference access on every
  GET/HEAD/range before invoking storage. Context is descriptive, never a reusable authorization
  credential. Resolve only the pinned version and named prepared rendition; no latest-version
  fallback, arbitrary transformations or redirects. Verify upstream status, MIME, lengths and
  range before returning bytes. Support closed/open/suffix single ranges and controlled 416;
  validate integer bounds and cancel upstream on disconnect. Keep all delivery signatures internal.
  HTTP boundary supplies private,no-store and nosniff; HEAD yields headers without body.
- Delete: caller locks/checks current Project, historical Order and in-flight job references before
  dispatching cleanup outside its transaction. Delete exactly the pinned object, never a reused
  key/newer version. Missing object succeeds; provider failure stays typed and retryable as appropriate.
  Provider cleanup never restores revoked access.
- Account gate: genuine anonymous original AND prepared derivative denial must be proven in P07
  before participant uploads. Fake tests are not account protection evidence.
- Policy uses decimal MB (1 MB = 1,000,000 bytes), conservatively bounded. Initial formats are
  JPEG/PNG/WebP, MP4/WebM video, MPEG/MP4/Ogg/WAV/WebM audio; active content is excluded.
  Expanding formats requires trusted inspection and security review.

P02 configuration and provider limitations:

- Configure backend-only `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET` and `CLOUDINARY_UPLOAD_PRESET_IMAGE/VIDEO/AUDIO`.
  Each preset must be signed, minimal, with category `allowed_formats`; hidden
  transformations, eval hooks, folders, delivery/access overrides are rejected.
- Signature SHA-256 covers the fixed public ID, authenticated delivery type,
  overwrite=false, exact formats and owner/asset/intent context. Endpoint is built
  from an allowlisted cloud name, never supplied by the caller. The public API key
  identifies the account; the API secret and delivery signatures remain internal.
- Cloudinary enforces a one-hour signature lifetime, not a caller-supplied short
  expires_at. Intake returns that actual expiry, anchored to asset creation;
  retries never extend it or create another asset. Expired/closed intents return
  conflict; deliberate new uploads use a new idempotency key.
- Cloudinary presets do not support per-preset byte limits. Declared bytes and
  optional duration are validated here; actual category/bytes/duration remain
  untrusted until P03 inspection. P02 never marks an asset Ready. Strict byte caps
  before provider storage would require an approved bounded upload gateway;
  direct-upload signatures alone cannot provide that guarantee.
- Official references: https://cloudinary.com/documentation/authentication_signatures
  and https://cloudinary.com/documentation/upload_presets .
- `test:media-upload` exercises real-DB/API initiation with a deterministic upload
  fake. `test:media-upload:smoke` uses configured Cloudinary with a synthetic PNG,
  verifies overwrite rejection, and deletes only that run's fixed object. It is
  not P07 account/derivative privacy acceptance.

P03 trusted finalization:

- `POST /media/{id}/finalize` requires the active asset owner, Origin, CSRF,
  Idempotency-Key and exactly `{uploadCompleted:true}`. The body is a hint only.
  Cross-owner/unknown IDs share a safe 404; client metadata/provider IDs are rejected.
- Bind the finalize intent to actor, asset and canonical request before external
  work. Cloudinary Admin API calls run outside DB transactions. Reauthorize the
  account and lock the asset again before committing any transition.
- Probe authenticated image/video namespaces using the backend-derived key.
  Audio is provider video with audio codec evidence and no visual stream; video
  requires visual codec/dimension evidence. Ambiguous namespaces are a conflict.
  Verify context owner/asset/intent, delivery type, format-to-MIME mapping, byte
  count, timed duration, moderation state and positive provider version. Do not
  trust or expose provider delivery URLs or the browser upload response.
- Missing/in-progress resources return 202 Pending. Provider auth/config/rate/
  network uncertainty returns controlled 503 and retains Pending for retry.
  Unsafe facts commit Unavailable before returning 422; immutable collisions
  return 409. Rejected uploads cannot be promoted by retrying finalization.
- Safe finalization atomically pins storage key, provider version, actual bytes,
  content type, duration (rounded up to milliseconds) and verified timestamp.
  The current DB schema supports positive 32-bit provider versions; values beyond
  that range fail closed. Only Ready results are returned with 200; no contentPath
  is advertised before the P04 stream endpoint exists.
- Repeated/concurrent finalization returns the pinned result without fetching a
  newer object or rewriting verified facts. Pending/503 responses do not freeze
  the intent: the same key can retry inspection. Completed replays still check
  current owner/account access. A stale worker cannot demote Ready content.
- `test:media-upload` includes T23 real-DB/API duplicate-finalization tests,
  invalid metadata and account-disable-during-inspection checks. The configured
  image smoke independently inspects uploaded synthetic PNG metadata via Admin
  API before cleanup. P07 anonymous original/derivative acceptance remains separate.
- Provider references: https://cloudinary.com/documentation/admin_api and
  https://cloudinary.com/documentation/control_access_to_media .
