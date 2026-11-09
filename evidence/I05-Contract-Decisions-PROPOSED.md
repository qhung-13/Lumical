# I05 — Đề xuất quyết định D01/D02

Ngày: 2026-11-09 (Asia/Saigon). **PROPOSED — CHƯA ĐƯỢC LEAD PHÊ DUYỆT.**

Tài liệu này chuẩn bị quyết định để review, không sửa API/business/architecture authority, replay semantics hoặc dữ liệu deployment. Branch hardening chứa các bản sửa độc lập; D01/D02 không phải điều kiện để chạy regression, nhưng vẫn là gate cho nghiệm thu milestone.

## D01 — Staged Project DTO

Nguồn: `docs/API_CONTRACT.md` §11–17; I05-P03; `backend/src/modules/calendar-projects/interface/dto.ts`; `backend/openapi.json`; `frontend/src/api/generated.ts`; `planning/I07-studio-personalization.md` và I08. Approved §16 mô tả một Project đầy đủ. Implementation hiện tại chỉ có core projection; chưa tìm thấy approval chính thức cho ngoại lệ theo giai đoạn.

| Nội dung approved | Implementation I05 thực tế | Endpoint / shape | Trạng thái |
| --- | --- | --- | --- |
| Identity | `id,title,year,recipientName` | Create/list/detail/PATCH/archive/restore | Có |
| Lifecycle/version | `status,version`; status WORKING/ARCHIVED; ETag | Core responses, If-Match cho mutations | Có |
| Captured baseline | `baseline.name.{vi,en}`, `baseline.layout.{version,type,monthCount,maxImagesPerMonth}`, `stylePresetId` | Core responses; Template identity/revision/price lưu nội bộ | Có projection; không serialize ORM/owner/price |
| Timestamps | `createdAt,updatedAt` | Core responses | Có |
| Deletion eligibility (§17 detail) | `deletionEligible:boolean` từ Order history | Chỉ GET `/projects/{id}`; DELETE kiểm tra lại | Có |
| Ordered Months | Không embedded trong core DTO | GET `/projects/{id}/months` → `{data:{months:[{monthNumber,caption}],projectVersion}}`, ETag | Đã có endpoint riêng, đúng 12; images/editor chưa có |
| Personal events | Không có field/route triển khai | `/projects/{id}/special-dates` được hoạch định | Chưa có; I07 |
| Current AR config | Không có field/route triển khai | `/projects/{id}/ar` được hoạch định | Chưa có; I07 authoring/I08 preparation |
| Readiness/preview | Không có field/route triển khai | `/readiness`, `/preview` được hoạch định | Chưa có; không trả dữ liệu giả hoặc cờ Ready mặc định |

Core DTO có **10** top-level keys: `id,title,year,recipientName,status,version,stylePresetId,baseline,createdAt,updatedAt`; detail thêm `deletionEligible` thành **11**. Không có `ownerId`, `templateRevisionId`, `unitPriceMinor`, events hay readiness trong JSON hiện tại.

### Amendment tối thiểu được đề xuất

Sau approval, API owner có thể thay riêng dòng `Project` ở §16 bằng nội dung sau và thêm ghi chú dưới nhóm Templates/Projects ở §17. **Đây chỉ là bản đề xuất, chưa áp dụng vào authority:**

> Project core projection tại I05 gồm identity, Working/Archived state, captured baseline/style, root version và timestamps. GET detail thêm deletionEligible từ trusted Order history. Twelve-Month summaries được trả cùng nhau qua GET /projects/{id}/months kèm projectVersion. Personal events, current AR configuration, preview và readiness được bổ sung qua các endpoint được chỉ định tại milestone I07/I08; không tuyên bố các capability đó đã được triển khai ở I05. Mọi private projection vẫn owner-authorized và no-store.

> Các mở rộng sau phải additive, giữ nguyên field và nghĩa của core projection, cùng root ETag/If-Match contract. Client ghép các resource chỉ khi projectVersion nhất quán. Không thêm trạng thái ProjectPaid/Ordered, không đổi creation-year rule và không biến absence thành Ready. Creation replay tiếp tục trả original bound outcome, độc lập với current detail hoặc capability mở rộng sau này.

### Compatibility / hậu quả

- Không đổi wire shape hiện tại, URL, HTTP status, error envelope, DB schema hoặc API prefix `/api/v1`; chưa có lý do cho API v2.
- Frontend `Project` được suy từ `operations.createProject`, detail/months suy từ operation riêng; validators kiểm tra core. Các field hiện hữu không được đổi tên/xóa/đổi kiểu. Việc mở rộng endpoint/read DTO sau này phải cập nhật OpenAPI và regenerate types trong cùng PR đã review.
- Không thêm required events/AR/readiness vào creation response một cách làm hỏng safe-result v1 đã lưu. Duy trì immutable creation-outcome projection; nếu sau này cần thay shape của creation response, phải thiết kế versioned replay compatibility riêng. Không backfill lịch sử bằng current state chỉ để khớp type mới.
- I07 child writes dùng owner-scoped Project root lock, cùng transaction context và expected **Project** version; child + root increment phải commit atomically. I08 provider work ở ngoài DB locks. Staged projection không bãi bỏ các acceptance gates này.
- Regression cần giữ: exact core keys/no private columns; detail eligibility; 12 ordered Months/version; frontend runtime checks; replay sau edit/archive/delete; child/root race khi I07 được triển khai. Không đánh dấu tests tương lai PASS.

**Lead/API owner cần quyết định:** chấp thuận wording staged DTO và mapping endpoint/milestone; xác nhận giữ creation-outcome core ổn định; chỉ định reviewer và approval record (người, ngày, commit/ticket). Đến lúc đó D01 vẫn **DECISION REQUIRED**.

## D02 — Legacy idempotency replay

### Nguồn gốc xác minh bằng Git

| Commit / thời điểm commit (UTC+07) | Bằng chứng |
| --- | --- |
| `92d339f`, 2026-10-13 01:00:44 | I01 tạo `idempotency_records.safe_result JSONB` nullable; Prisma vẫn là `Json?`. Không có default backfill hoặc NOT NULL dành riêng cho PROJECT_CREATE. |
| `0cd2a0f`, 2026-11-05 00:26:19 | P02 `PrismaProjectCreation.create()` ghi actor/operation/key/digest/condition/resource type/id, **bỏ safeResult** → SQL NULL. Replay khi đó trả resource ID. |
| `02e1834`, 2026-11-05 13:31:38 | P03 thêm public REST; writer cũ vẫn có thể tạo NULL outcome. |
| `ed6888e`, 2026-11-05 21:08:57 | Writer bắt đầu persist `projectView(project)` trong cùng transaction; reader bắt buộc `storedProjectView(record.safeResult)`. Không kèm migration/backfill. |
| `f1f7c03`, 2026-11-05 07:39:07 | First-parent dev merge P02: application port có thể được gọi nội bộ, chưa có Project REST controller. |
| `c7af6aa`, 2026-11-05 22:17:44 | First-parent dev merge P03 đã bao gồm `ed6888e`. Nếu chỉ deploy các merged dev commits, public REST đầu tiên đã có safe writer. Đây là **suy luận về code lineage**, không chứng minh lịch sử deployment/database. |

Mọi writer PROJECT_CREATE hiện tại trong source chính đều qua `PrismaProjectCreation`; safe body được ghi atomically. Seed/fixture thông thường không ghi Project creation intent; DB Project fixtures trực tiếp không chứng minh legacy intent tồn tại. Regression của audit cố ý tạo NULL outcome trong disposable DB. Các branch builds, direct application-port calls, scripts ngoài repo hoặc restore từ snapshot vẫn cần operator xác minh; Git timestamp không phải cutoff dữ liệu.

Resource ID không có FK tới CalendarProject, nên outcome phải tồn tại được sau hard delete. `actor_id` vẫn FK restricted tới User. Không được xóa intent vì root hiện không còn. `safe_result IS NULL`, JSON literal `null`, malformed JSON object và metadata sai là các trường hợp khác nhau cần inventory/validation.

### Inventory và quyền truy cập

**Chưa có deployment/demo/shared DB được cấp quyền đọc trong task này. Không dùng `.env` để dò kết nối hoặc kết luận Case A.** Chỉ disposable PostgreSQL được phép dùng để kiểm chứng SQL và runtime behavior.

SQL chuẩn bị: `backend/scripts/inventory-project-replay.sql`. Script dùng REPEATABLE READ + READ ONLY, bounded timeouts và ROLLBACK; chỉ xuất metadata/aggregate counts, không xuất idempotency key, digest, body, actor ID, title hoặc secrets. Một JSON object chưa đủ chứng minh body hợp lệ hoặc provenance đáng tin cậy.

Hướng dẫn cho operator có quyền:

1. Xác nhận rõ environment/database được phép, principal SELECT tối thiểu và deployment range cần hỗ trợ; không chạy trên DB ngoài quyền.
2. Dùng connection/service được quản lý sẵn; không đặt password/URL trong command history hoặc PR. Ví dụ trên máy đã cấu hình service: `psql service=<approved-service> -X -v ON_ERROR_STOP=1 -f backend/scripts/inventory-project-replay.sql`.
3. Chạy trên từng environment cần hỗ trợ, lưu label environment, thời gian snapshot, SQL revision/hash, count results và deployment evidence. Redact tên DB/principal trước khi đính vào PR công khai. Inventory trên replica chỉ có ý nghĩa với snapshot/replication lag được ghi nhận.
4. Scan **tất cả** PROJECT_CREATE, không chỉ trước giờ commit. Nếu không có quyền SELECT hoặc query timeout, ghi UNVERIFIED; không coi thiếu kết quả là zero.
5. Cung cấp aggregate evidence cho Lead; per-record investigation thực hiện riêng trong kênh dữ liệu hạn chế. Không dump raw safe_result ra logs của PR.

### Decision matrix A/B/C

| Case | Điều kiện bằng chứng | Đề xuất | Gate / risk |
| --- | --- | --- | --- |
| A | Inventory đầy đủ trên mọi DB được hỗ trợ không có missing/invalid outcome; deployment lineage được xác minh | Ghi Case A với snapshot/scope; không tạo data migration; giữ characterization/upgrade fixture tests | Không suy A từ DB mới hoặc một environment duy nhất. Lead xác nhận phạm vi/cutover. |
| B | Có records và một nguồn đáng tin cậy giữ exact original outcome (ví dụ transaction-consistent backup/audited original response), binding actor/key/digest/resource được chứng minh | Chuẩn bị reconciliation manifest hạn chế, validate shape/provenance, backfill có guard trong transaction, rồi verify replay và dữ liệu không đổi | **PROPOSED ONLY**; cần DB/Lead approval trước SQL ghi. Current version=1 không tự chứng minh original response. |
| C | Có records nhưng không thể chứng minh original outcome, root đã edit/archive/delete hoặc lịch sử thiếu | Giữ fail-closed/no duplicate; không lấy current Project làm original; operator-assisted reconciliation | Hiện trả safe 500. Có thể đề xuất lỗi 409 `IDEMPOTENCY_RECONCILIATION_REQUIRED`, retryable=false, giữ intent/draft và requestId; cần approval §9/§11 trước đổi semantics/DTO/UI. |

**Hiện tại: chưa chọn được A/B/C cho deployment.** Disposable fixture chứng minh Case C behavior và inventory đọc được, không chứng minh distribution của dữ liệu thật.

### Kế hoạch Case B nếu được phê duyệt sau này

Không có executable backfill/migration trong PR hardening. Plan cần: backup/restore drill; snapshot inventory; trusted recovery manifest gồm original outcome và nguồn chứng cứ; maintenance/locking plan tránh đua cùng remediation; kiểm tra actor/operation/key/request digest/resource/condition và safe_result vẫn thiếu; validate DTO và original creation revision; update duy nhất safe_result; commit theo batch bounded; audit count/checksum; replay exact body/ETag; kiểm tra root/order/month rows không đổi. Abort mọi mismatch, không overwrite một outcome đã được tiến trình khác sửa.

Rollback phải giữ bản trước trong kho hạn chế và được reviewer duyệt. Không xóa key, không re-create Project, không rollback bằng rewrite applied migration, không log body/credential. Việc rollback code về writer trước `ed6888e` có thể tạo thêm legacy records và không phải phương án rollout an toàn.

**Lead/DB owner cần quyết định:** ai chạy inventory trên environment nào; deployment histories cần hỗ trợ; chọn A/B/C dựa trên bằng chứng; phê duyệt Case B data-write plan hoặc Case C reconciliation/error policy nếu cần. D02 vẫn **DECISION REQUIRED**, production replay code không đổi.
