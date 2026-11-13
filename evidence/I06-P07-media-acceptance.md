# I06-P07 — Private Storage and Media Integration Acceptance Evidence

## Tổng quan (Overview)

- **Task**: I06-P07 (Private storage and media integration acceptance)
- **Mục tiêu**: Chứng minh adapter Cloudinary thực tế đáp ứng đầy đủ các yêu cầu về tính riêng tư (privacy), xác thực quyền sở hữu, từ chối ẩn danh (anonymous denial) đối với cả file gốc và các bản phái sinh (derivatives) đã được tạo thực tế, giới hạn kích thước/loại tệp/thời lượng, truyền tải dữ liệu phân đoạn (byte-range streaming), và tính lũy kế/idempotency khi hoàn tất tải lên lặp lại.
- **Provider cấu hình**: Cloudinary (Account `dvvh5ylnm`, Signed Presets: `ml_default`, `ml_video`, `ml_audio` — cả 3 `unsigned: false`, chỉ chứa `allowed_formats`, không transformation/eval/folder ẩn).
- **Nội dung kiểm thử**: Dữ liệu tổng hợp (synthetic media: PNG, GIF, WAV, MP4) được tạo trong bộ nhớ/ffmpeg tổng hợp; mọi đối tượng được xác nhận dọn sạch (`DELETED`) qua Admin API sau mỗi lần chạy. Không chứa bất kỳ dữ liệu nhạy cảm, API secret, chữ ký hay signed delivery URL nào trong log bằng chứng.
- **Lần chạy gần nhất**: 2026-11-13 — **`23 PASS · 2 NOTE · 0 SKIP`, exit 0** (review round 1, xem mục cuối).

Lệnh thực thi:
```bash
pnpm --dir backend test:media:privacy
# (video duration trial cần ffmpeg: P07_FFMPEG=<đường dẫn> hoặc ffmpeg trong PATH;
#  nếu thiếu thì trial là SKIP rõ ràng, không bao giờ tính thành PASS)
```

---

## Bằng chứng kiểm thử chấp nhận Cloudinary (`test:media:privacy`)

### Kết quả chạy kiểm thử các cổng G0 – G6:

| Mã cổng | Mục kiểm tra | Kết quả | Chi tiết bằng chứng |
| --- | --- | --- | --- |
| **G0** | Precondition: Signed Presets & Format Allowlist | **PASS** | Cả 3 preset `ml_default` / `ml_video` / `ml_audio` đều `unsigned: false`, `allowed_formats` lần lượt `jpg,png,webp` / `mp4,webm` / `mp3,m4a,ogg,wav,webm`, không chứa transformation/eval/folder option. |
| **G1** | Anonymous Original Denial | **PASS** | Yêu cầu trực tiếp file gốc không qua xác thực: HTTP 401, 0 bytes media, không redirect tới URL đã ký. |
| **G2** | Prepared & On-the-fly Derivatives Denial | **PASS** | **(a)** Tạo prepared derivative THẬT: signed rendition `w_100` → HTTP 200 với 103 bytes; Admin API `GET /resources/...` trả mảng `derived` chứa `transformation=w_100`. **(b)** Anonymous GET cùng transformation đó → **HTTP 401, 0 bytes** (từ chối do xác thực, không phải asset không tồn tại). **(c)** 5 biến thể transformation on-the-fly (`w_100`, crop `200x200`, `f_auto,q_auto`, `f_jpg`, `f_webp,w_50`) + fallback `type=upload` → 401/404, 0 bytes. |
| **G3** | Owner Upload -> Finalize -> Ready | **PASS** | Upload synthetic 1x1 PNG (67 bytes) → Admin API inspect `VERIFIED` (`privateOriginal`/`privateDerivatives=true`) → finalize READY, `verifiedBytes=67` = bytes provider, `contentVersion` ghim cố định; `GET /media/{id}` chỉ lộ `contentPath` nội bộ, không rò provider URL/chữ ký/api key. |
| **G4** | Provider-backed Size, Type & Duration Validation | **PASS** | (a) `declaredBytes > 10.000.000` → API intake **422**. (b) GIF thật → provider **HTTP 400** kèm nguyên nhân format (`Image file format gif not allowed`) — assert đúng status + đúng nguyên nhân, không chấp nhận 5xx. (c) 13.236.203 B → provider **HTTP 400** `File size too large … Maximum is 10485760`; 10.403.238 B (nằm giữa `MEDIA_LIMITS` và plan limit — **gate bắt buộc**) → provider lưu, finalize **422**, asset `UNAVAILABLE`, `verified_bytes=NULL`. (d) Audio WAV 61 s → provider báo `61.000` s → finalize **422**. (e) **Video MP4 61 s** (ffmpeg tổng hợp, preset `ml_video`) → provider báo `61.000` s → finalize **422**, asset `UNAVAILABLE`. |
| **G5** | Owned Private Stream, Headers & Range Requests | **PASS** | `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Vary: Cookie`, `Accept-Ranges: bytes`; Range Closed/Open/Suffix khớp từng byte, vượt giới hạn → **416** `Content-Range: bytes */67`; anonymous và cross-owner → 401/404; header dump không chứa provider URL/chữ ký/api key. |
| **G6** | Concurrent & Duplicate Finalization Safety | **PASS** | Replay cùng `Idempotency-Key` + 4 finalize đồng thời → tất cả 200, body giống hệt. DB: đúng 1 asset, `contentVersion` duy nhất; **đối chiếu từng key**: đúng **5 record** cho đúng 5 key đã dùng, mỗi record `condition=COMPLETED`, `safe_result` giống hệt body đã trả về, cùng `request_digest`; không asset READY thứ hai. |
| **Cleanup** | Exact Binding Resource Deletion | **PASS** | 6/6 object của run (`g3-ready`, `g4-gif`, `g4-size-plan`, `g4-size-cap`, `g4-duration`, `g4-video`) → **DELETED**. Nếu một object nào không `DELETED` → in `CLEANUP-FAIL` và **suite FAIL (exit ≠ 0)**, không bao giờ chỉ ghi log. |

### Phân loại PASS / NOTE / SKIP (dòng tổng kết: `23 pass, 2 note, 0 skip`)

- **PASS (23)**: toàn bộ gate ở bảng trên — mỗi gate bắt buộc đều là PASS thật, không PASS giả từ NOTE/SKIP.
- **NOTE (2)** — thông tin, không phải gate: (1) G0 image preset settings keys; (2) G4 type: preset đã cấp intent cho asset GIF và provider từ chối payload.
- **SKIP (0)** trong lần chạy này. (Nếu runner thiếu ffmpeg → video duration trial là SKIP rõ ràng, được ghi nhận là trial bổ trợ; gate duration bắt buộc vẫn là trial audio.)

---

## Bằng chứng kiểm thử hồi quy Media & Cơ sở dữ liệu

1. **`test:media-upload` (T23 / P04)**:
   - PASS: P04 owner status and Supertest private GET/HEAD/ranges, no-store/nosniff, safe denial, provider validation and revocation.
   - PASS: T23 trusted finalization, real-DB concurrent duplicate handling, limits, binding, immutable replay, provider uncertainty and account disable race.
   - PASS: media upload API ownership/CSRF/limits, changed intent, replay/concurrency, provider retry and expiry (real DB, fake provider).

2. **`test:media-cleanup` (T24 / T26 / P06)**:
   - PASS: T24/T26 real-DB/API history retention, current refs/jobs, reference race, durable retry/lease fencing/exhaustion, orphan cleanup and immediate revocation.
   - PASS: same-build worker CLI runs one bounded pass and exits.

3. **`test:db` (Toàn bộ migrations & modules database)**:
   - PASS: I01 database foundation, idempotence & migrations.
   - PASS: I02 identity and sessions.
   - PASS: I04 template catalog & admin.
   - PASS: I05 project creation, month navigation & lifecycle rest.
   - PASS: I06 media upload, finalization and cleanup guards (T23/T24/T26).

4. **Static / frontend**: backend build+lint+typecheck · unit 354/354 · `contract:generate`/`contract:check` · frontend typecheck+lint+test 145/145 · e2e chromium+firefox 70 passed.

---

## Review round 1 (LEAD, 2026-11-13) — 4 điểm đã xử lý

| Điểm review | Xử lý | Kết quả chạy lại |
| --- | --- | --- |
| G2 mới kiểm tra transformation URL, cần prepared derivative tạo thực tế | Tạo derivative thật bằng signed rendition `w_100` (HTTP 200, 103 bytes) → xác nhận qua Admin API `derived` → mới test anonymous | **PASS**: derivative tồn tại và vẫn bị 401 khi ẩn danh |
| G4 cần đúng HTTP status + nguyên nhân; gate bắt buộc không được PASS khi chỉ SKIP/NOTE | Assert GIF = 400 + nguyên nhân format, size = 400 + "too large"; backend-cap thành gate bắt buộc (bỏ nhánh NOTE); thêm video duration thật; đếm PASS/NOTE/SKIP riêng | **23 pass · 2 note · 0 skip** |
| Cleanup phải FAIL nếu không xóa được | Purge != `DELETED` → `CLEANUP-FAIL` + exit ≠ 0 | 6/6 DELETED, exit 0 |
| G6 phải verify durable outcome theo từng key | Đối chiếu đúng 5 key → 5 record, mỗi record `COMPLETED` + `safe_result` giống hệt + cùng digest | PASS |

**Redaction**: bằng chứng không chứa `api_secret`, chữ ký (`s--…--`), URL delivery đã ký, cookie/session, token. Giá trị in ra chỉ gồm tên preset, HTTP status, thông điệp lỗi provider, số đo byte/duration, UUID asset tổng hợp, `contentVersion`.
