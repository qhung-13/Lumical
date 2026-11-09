# Cloudinary private adapter contract (I06-P01)

Implementation contract for P02-P04; no live adapter or endpoint is registered by P01.
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