# I06-P07 — Private Storage and Media Integration Acceptance Evidence

## Tổng quan (Overview)

- **Task**: I06-P07 (Private storage and media integration acceptance)
- **Mục tiêu**: Chứng minh adapter Cloudinary thực tế đáp ứng đầy đủ các yêu cầu về tính riêng tư (privacy), xác thực quyền sở hữu, từ chối ẩn danh (anonymous denial) đối với cả file gốc và các bản phái sinh (derivatives), giới hạn kích thước/loại tệp/thời lượng, truyền tải dữ liệu phân đoạn (byte-range streaming), và tính lũy kế/idempotency khi hoàn tất tải lên lặp lại.
- **Provider cấu hình**: Cloudinary (Account `dvvh5ylnm`, Signed Presets: `ml_default`, `ml_audio`, `ml_video`).
- **Nội dung kiểm thử**: Dữ liệu tổng hợp (synthetic media: PNG, GIF, WAV) được tạo trực tiếp trong bộ nhớ; mọi đối tượng được dọn dẹp sạch sẽ qua Admin API sau khi hoàn thành chạy kiểm thử. Không chứa bất kỳ dữ liệu nhạy cảm, API secret hay signed delivery URL nào trong log bằng chứng.

---

## Bằng chứng kiểm thử chấp nhận Cloudinary (`test:media:privacy`)

Lệnh thực thi:
```bash
pnpm --dir backend test:media:privacy
```

### Kết quả chạy kiểm thử các cổng G0 – G6:

| Mã cổng | Mục kiểm tra | Kết quả | Chi tiết bằng chứng |
| --- | --- | --- | --- |
| **G0** | Precondition: Signed Presets & Format Allowlist | **PASS** | `ml_default` là preset đã ký (`unsigned: false`), cấu hình `allowed_formats: [jpg, png, webp]`, không chứa bất kỳ transformation/eval ẩn nào. |
| **G1** | Anonymous Original Denial | **PASS** | Yêu cầu trực tiếp file gốc không qua xác thực bị từ chối với HTTP 401 (`0 bytes`, `x-cld-error: deny or ACL failure`). Không có dữ liệu media rò rỉ. |
| **G2** | Prepared & On-the-fly Derivatives Denial | **PASS** | Mọi biến thể biến đổi URL ẩn danh (`w_100`, `c_fill,w_200,h_200`, `f_auto,q_auto`, `f_jpg`, `f_webp`, fallback sang public unsigned `upload`) đều bị chặn hoàn toàn với HTTP 401 / HTTP 404 (0 bytes). |
| **G3** | Owner Upload -> Finalize -> Ready | **PASS** | Upload synthetic 1x1 PNG xác thực qua Admin API (`67 bytes`), ghim phiên bản `contentVersion`, cập nhật trạng thái `READY`, trường `contentPath` nội bộ `/api/v1/media/{id}/content` được bảo vệ bằng session cookie. Không lộ URL hoặc khóa Cloudinary. |
| **G4** | Provider-backed Size, Type & Duration Validation | **PASS** | (a) Khai báo > 10 MB bị chặn ngay từ API intake (HTTP 422).<br>(b) Định dạng không cho phép (GIF) bị preset từ chối (HTTP 400).<br>(c) File vượt trần kích thước provider (> 10 MB) bị từ chối; file nằm giữa trần backend và provider bị finalize từ chối 422, đánh dấu `UNAVAILABLE`.<br>(d) File âm thanh WAV 61s vượt giới hạn 60s bị finalize từ chối 422. |
| **G5** | Owned Private Stream, Headers & Range Requests | **PASS** | Stream qua GET/HEAD duy trì `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Vary: Cookie`. Hỗ trợ chuẩn xác byte range (Closed `0-3`, Open `4-66`, Suffix `-4`), trả về HTTP 206 Partial Content. Range vượt giới hạn trả về HTTP 416 `Content-Range: bytes */67`. Truy cập ẩn danh hoặc chéo tài khoản trả về HTTP 401 / 404. |
| **G6** | Concurrent & Duplicate Finalization Safety | **PASS** | Replay cùng Idempotency-Key và 4 request finalize đồng thời trên cùng asset hội tụ chính xác về một bản ghi duy nhất, cùng `contentVersion`, 5 idempotency records, không sinh xung đột hay duplicate rows. |
| **Cleanup** | Exact Binding Resource Deletion | **PASS** | Toàn bộ các đối tượng tạo trong đợt kiểm thử (`g3-ready`, `g4-gif`, `g4-size-plan`, `g4-size-cap`, `g4-duration`) đều được Admin API xóa sạch hoàn toàn (`DELETED`). |

---

## Bằng chứng kiểm thử hồi quy Media & Cơ sở dữ liệu

1. **`test:media-upload` (T23 / P04)**:
   - PASS: P04 owner status and Supertest private GET/HEAD/ranges, no-store/nosniff, safe denial, provider validation and revocation.
   - PASS: T23 trusted finalization, real-DB concurrent duplicate handling, limits, binding, immutable replay, provider uncertainty and account disable race.
   - PASS: media upload API ownership/CSRF/limits, changed intent, replay/concurrency, provider retry and expiry (real DB, fake provider).

2. **`test:media-cleanup` (T24 / T26 / P06)**:
   - PASS: T24/T26 real-DB/API history retention, current refs/jobs, reference race, durable retry/lease fencing/exhaustion, orphan cleanup and immediate revocation.
   - PASS: same-build worker CLI runs one bounded pass and exits.

3. **`test:db` (Toàn bộ 8 migrations & modules database)**:
   - PASS: I01 database foundation, idempotence & migrations.
   - PASS: I02 identity and sessions.
   - PASS: I04 template catalog & admin.
   - PASS: I05 project creation, month navigation & lifecycle rest.
   - PASS: I06 media upload, finalization and cleanup guards.
