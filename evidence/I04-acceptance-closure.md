# I04 — Acceptance closure

Nhánh `fix/i04-acceptance-closure` được tạo từ local `dev` tại `c88cb02cff7df41ebde98c5d3e48a0aa169eb3fa`. HEAD vẫn là SHA này. Các thay đổi nằm trong working tree. SHA-256 của `i03-closeout.diff` trước và sau là `50DD27E819BB3DB4BB9289B6498EE5B0CA9F9C1069F1DBFC648170A1FB0AD4A6`.

Git ghi nhận report cũ được thêm ở `4c4318d`, cập nhật ở `c58e539` và xóa ở `42fd14a`, trước merge `c88cb02`. Commit xóa chỉ có tiêu đề xóa file. Lý do xóa là **UNKNOWN**. Kết quả lịch sử trong report đó là tài liệu tham khảo.

## Bằng chứng theo finding

| ID | Phân loại | Bằng chứng |
| --- | --- | --- |
| F01 | VERIFIED test gap | `backend/scripts/test-template-admin.mjs` thêm ca I04-P05 trên Nest HTTP và PostgreSQL dùng một lần. Activate revision 1, chèn Project fixture, publish revision 2 với tên, layout, preset và giá khác, rồi deactivate. So sánh bảy cột gồm revision ID, hai tên, style, preset ID, giá và currency sau mỗi mutation. Kiểm tra revision cũ giữ nguyên, runtime UPDATE bị từ chối, Public list loại Template và detail trả safe 404. |
| H01 | VERIFIED defect | Regression mock cho publication tái hiện cùng payload sau refresh gửi key mới và `If-Match: "5"` thay cho `"4"`. Cùng mount, payload gốc replay với key và version gốc. Payload thay đổi hoặc remount có marker chưa giải quyết yêu cầu operator xem lại Catalog và xác nhận trước khi gửi lần mới. Storage theo tab lưu key ngẫu nhiên và hash của scope actor/operation/Template. Payload và expected version giữ trong bộ nhớ. |
| H02 | VERIFIED defect | Sáu ca fail trước sửa gồm cursor lặp, cycle, null, rỗng, toàn khoảng trắng và abort giữa chừng. Detail lookup theo dõi cursor đã thấy, tôn trọng abort và trả lỗi có thể thử lại khi kết quả chưa đủ. Backend Admin dùng `createdAt, id`; hơn mười trang hợp lệ vẫn đi đến cuối. |
| H03 | VERIFIED limitation | Public §17 và quyết định P01 quy định name VI + UUID theo Catalog hiện hành. Ca HTTP/PostgreSQL 17.11 quan sát một UUID lặp và một UUID bị bỏ qua khi đổi tên hai Template qua hai phía cursor cũ. Public UI gộp UUID trùng trong các trang đang hiển thị. Refresh danh sách từ đầu đọc thứ tự mới. Hợp đồng hiện tại chưa có snapshot guarantee. |
| H04 | VERIFIED coverage gap và cache defect | Tách gate HTTP/DB và browser mocked khỏi browser live. Playwright project opt-in chạy Next dev proxy qua Nest chỉ bind loopback với PostgreSQL do gate tạo. Browser create, publish, activation, public detail, search/category, cursor qua proxy, deactivation và safe 404. Fault injection chỉ làm mất phản hồi sau publish thật. Gate PostgreSQL riêng kiểm tra CSRF, Origin, role, preconditions, concurrency, audit rollback và revision immutability. Hai test đã tái hiện list/detail gửi GET dưới anonymous key khi bootstrap. Sau sửa, các query đợi actor ID. Component test đổi actor trong cùng QueryClient để kiểm tra cache isolation. |
| H05 | VERIFIED on PostgreSQL 17.11 | I01 qua fresh deploy 6 migrations, schema/history check, deploy lần hai, upgrade fixture, least privilege và case từ chối migration khi thiếu mapping. Mapping cho fixture là dữ liệu test. Database có legacy Template cần mapping do owner duyệt trước deploy. |
| T21 | VERIFIED coverage and defects | Public Playwright có VI/EN, light/dark, 320px, focus và axe. Admin thêm focus return, accessible description cho lỗi và 320px với hai cặp VI/EN và light/dark. Admin dùng `--motion-fast` để thời lượng giảm về 0 khi bật reduced motion. Reproduction HTML độc lập trong Windows WebKit cho thấy Tab bỏ qua skip link mặc định và chọn link có `tabIndex={0}`. Hai I04 shell đặt tab stop tường minh. 200% text-size trong foundation suite là một phép đo riêng với browser toolbar zoom. |

## D01 — Đề xuất cho Lead

**DECISION REQUIRED.** ROADMAP §3 và I04 item acceptance yêu cầu chặn tạo Project mới từ Template inactive. I04-P05 giao phạm vi fixture/DB/API và loại trừ Project lifecycle. I05-P02 giao `POST /projects`, kiểm tra active, baseline capture và 12 Months trong transaction. I05 có hard dependency vào I04.

- Đề xuất câu cho acceptance row I04 trong ROADMAP và tiêu chí/demo I04. “Public Catalog excludes inactive Templates from discovery and detail. Published revisions and captured Project fixtures survive Catalog changes. Admin mutations are audited. New Project rejection and atomic capture are verified in I05-P02.”
- Giữ T02 thực tế tại I05-P02. Giữ T03 fixture preservation tại I04-P05 và bổ sung ca T03 end-to-end trong I05-P02 sau khi create thật. Gate sản phẩm vẫn yêu cầu T02/T03 và các BR-TPL-001–003 đầy đủ.
- Giữ dependency I04 → I05. Chờ Lead duyệt wording và cập nhật các tài liệu được quản lý bằng một thay đổi riêng.

## D02 — Đề xuất cho policy HTTP errors

**DECISION REQUIRED, repository-wide.** API Contract §9 và global `ApiErrors` dùng `INTERNAL_ERROR` 500 cho exception chưa phân loại. `atomic()` trong I02 và I04-P02 retry serialization/deadlock có giới hạn, xử lý unique conflict và gộp phần lớn exception còn lại vào `PROVIDER_UNAVAILABLE` 503. Case audit insert bị thu hồi quyền hiện kiểm tra rollback và 503, cho thấy 503 đang bao gồm cả lỗi persistence ngoài dependency outage.

- Dùng 503 khi nhận diện được lỗi kết nối hoặc dependency unavailable.
- Xử lý serialization/deadlock exhaustion theo nhóm retryable riêng trong nội bộ. Lead quyết định HTTP mapping và giữ nguyên Idempotency-Key khi retry.
- Chuyển exception lập trình, invariant hoặc persistence không dự kiến về global 500 và log có correlation ID. Cập nhật contract/OpenAPI và negative tests theo policy được duyệt.
- Hiện Admin GET retry tối đa hai lần với 5xx. Mutation cần hành động của operator và giữ intent khi kết quả chưa rõ.

## Cách tái chạy

Chạy từ repository root với Node 24.21.0, pnpm 11.22.0, Chromium/Firefox/WebKit do Playwright quản lý, quyền loopback và Docker Linux engine có thể chạy `postgres:17.11-bookworm`.

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm test:visual
$env:LUMICAL_I04_LIVE_UI = '1'
pnpm --dir backend test:template-admin
Remove-Item Env:LUMICAL_I04_LIVE_UI
```

`pnpm test:db` chạy lần lượt gate I01, I02 và I04-P02/P05. `pnpm --dir backend test:template-admin` hữu ích khi cần tập trung vào F01/H03 hoặc browser live. Browser live dùng port frontend 3211 và backend port loopback do OS cấp. Chạy tách khỏi development services và giữ port 3211 trống. Browser mocked dùng port 3210 và cấu hình backend sentinel.

## Kết quả quan sát

| Gate | Exit | Kết quả |
| --- | ---: | --- |
| `pnpm typecheck`, `pnpm lint`, `pnpm build` | 0 | Frontend và backend. |
| `pnpm test` | 0 | 237 test qua, gồm 102 Vitest, 128 Jest và 7 Nest Supertest. |
| `pnpm --dir frontend exec vitest run --maxWorkers=1 --testTimeout=15000` | 0 | 102/102 trong 14 files. HTTP fixtures và transport mocks. |
| Backend Jest `--runInBand` | 0 | 128/128 trong 10 suites. |
| Backend Jest `--config ./test/jest-e2e.json --runInBand` | 0 | 7/7 Supertest. |
| `node --test infra/proxy.test.mjs` | 0 | 1/1 khi có quyền loopback. |
| `pnpm test:ui` | 0 | 75/75 sau sửa, 25 mỗi Chromium, Firefox và WebKit. Catalog/Admin API được mock. Lần đầu 69/75. Bản archive từ HEAD tái hiện năm ca WebKit lỗi focus. Ca đổi locale qua khi chạy baseline riêng và được đồng bộ với readiness của list trong test cuối. |
| `pnpm test:visual` | 0 | 4/4 Chromium với snapshot đã có. |
| `pnpm contract:check` | 1 | Backend byte comparison gặp CRLF trong checkout Windows với `core.autocrlf=true`. JSON sinh từ Nest khớp từng byte với `git show HEAD:backend/openapi.json` và khớp checkout sau chuẩn hóa CRLF. `node frontend/scripts/check-contract.mjs` exit 0. |
| `pnpm test:db` với Docker | 1 | Docker Desktop lỗi socket `dockerInference`. Linux engine pipe vắng. Gate Docker dừng trước khi tạo container. |
| Gate I01 native PostgreSQL 17.11 | 0 | 20 nhóm assertion, gồm migrations và least privilege. |
| Gate I02 native PostgreSQL 17.11 | 0 | 23 nhóm assertion. |
| Gate I04 HTTP native PostgreSQL 17.11 | 0 | 13 nhóm assertion, gồm F01, H03, role, Origin/CSRF, validation, idempotency/concurrency, audit rollback và revision immutability. |
| Live Chromium qua Next, Nest và native PostgreSQL 17.11 | 0 | 1/1. Publish thật, làm mất response, refresh, replay một revision, rồi activate/browse/deactivate. |

[Playwright UI report](C:/Users/LENOVO/.codex/visualizations/2026/11/04/01a1a548-6a73-7d61-b5ab-9cdae91dcd39/i04-ui-report/index.html) · [Playwright visual report](C:/Users/LENOVO/.codex/visualizations/2026/11/04/01a1a548-6a73-7d61-b5ab-9cdae91dcd39/i04-visual-report/index.html)

Manual browser toolbar zoom 200% trên Catalog và Admin form còn thiếu. Bằng chứng 200% tự động là text resizing trên các route foundation. Các kiểm tra reduced motion, keyboard/focus, lỗi gắn với input, VI/EN, theme, reflow và axe thuộc Playwright.

Để chạy fallback đã dùng, chạy hai script workspace-local dưới WSL Ubuntu. Shell lấy package đã ký từ PGDG, tạo cluster loopback riêng cho từng gate bằng script role bootstrap có sẵn. Node loader thay phần cấp phát container bằng URL của cluster vừa tạo. Các test, migrations và endpoint vẫn chạy từ repository. Runner dừng cluster và dọn thư mục do run tạo. Bản PostgreSQL thực tế là 17.11 trên Ubuntu, còn image chuẩn của repo là 17.11 trên Debian Bookworm.

- [i04-native-postgres.sh](C:/Users/LENOVO/.codex/visualizations/2026/11/04/01a1a548-6a73-7d61-b5ab-9cdae91dcd39/i04-native-postgres.sh)
- [i04-native-postgres-loader.mjs](C:/Users/LENOVO/.codex/visualizations/2026/11/04/01a1a548-6a73-7d61-b5ab-9cdae91dcd39/i04-native-postgres-loader.mjs)

```powershell
$folder = 'C:/Users/LENOVO/.codex/visualizations/2026/11/04/01a1a548-6a73-7d61-b5ab-9cdae91dcd39'
$wslFolder = (wsl -d Ubuntu --exec wslpath -u $folder).Trim()
wsl -d Ubuntu --exec bash "$wslFolder/i04-native-postgres.sh" "$wslFolder"
```

## Trạng thái bàn giao

**READY FOR LEAD REVIEW.** P01–P05 có evidence trong phạm vi I04. Lead cần chốt D01 và kiểm tra gate chuẩn trên checkout LF có Docker trước merge. Manual zoom 200% còn cần ghi nhận nếu dùng để chốt T21. D02 được đề xuất xử lý ở cấp repository. T02 Project create và T03 atomic capture được giữ trong I05-P02.
