# LumiCal I05 Hardening — Final Verification

Ngày: 2026-11-09, Asia/Saigon. Đây là báo cáo kỹ thuật để Lead review, không tự thay approval hoặc đánh dấu milestone DONE.

## A. Git Baseline

- Bắt đầu tại `dev`, HEAD `1a3a094c8d0e7e7c6c4dd383745f5949cafee459`.
- Đã tạo `fix/i05-integration-hardening` từ HEAD đó, mang theo nguyên working tree. Không commit, push, fetch, tạo PR, merge, reset, clean hoặc stage.
- Kiểm tra lại ban đầu: **14 tracked modifications, 19 untracked, không staged**. Trong 19 untracked có ba audit artifacts và 16 file có sẵn ngoài phạm vi. Số liệu khớp audit trước; không mặc định dùng lại mà đã đo thực tế.
- Đã đọc DEV_WORKFLOW, audit/handoff/diff và rules; không tìm thấy AGENTS.md/CLAUDE.md áp dụng trong repo/ancestor directories.
- Snapshot hash ban đầu lưu tại `.cache/i05-hardening/baseline.json`. Manifest PR phân biệt source/tests/evidence/proposals với 16 file cũ và local instrumentation helper. Kết quả hash/handoff cuối ở §G.
- Không thay approved `API_CONTRACT.md`, Business Rules, Architecture, DB schema, migration, generated API hoặc dependency lockfiles.

17 file của audit trước được giữ lại: 14 tracked files trong audit manifest, `evidence/I05-Full-Integration-Audit.md`, `frontend/e2e/project-integration.spec.ts`, `evidence/i05-audit-runtime.mjs`. File runtime cuối là helper riêng cho môi trường máy này, **giữ trên đĩa nhưng không đề xuất đưa vào PR**. Danh sách chính xác nằm trong `I05-Hardening-Manifest.json`.

## B. Hardening Findings

Line numbers theo branch hardening hiện tại. Seven fixes cũ không bị triển khai lại.

| ID / Severity | File:Line | Evidence | Fix | Test | Status |
| --- | --- | --- | --- | --- | --- |
| F01 MAJOR | `project-detail.tsx:40` | Ref guard được set trước await; mọi lifecycle action bị khóa đến khi mutation + refresh kết thúc | Giữ guard và readiness check; thêm H01 cho focus | Deferred request, không có mutation thứ hai; 412 explicit retry | RESOLVED |
| F02 MAJOR | `workspace-draft.ts:34` | Observer thuộc draft store, không bị unsubscribe khi rời route | Giữ cleanup khi logout/actor change; giữ draft trong loading/unavailable | Logout sau unmount; account A→B; design-change/lost-response cases | RESOLVED |
| F03 MAJOR | `configure-app.ts:24` | Allowlist đã có PATCH; không thay origin/CSRF policy | Giữ additive CORS method | Real OPTIONS + auth/CSRF/owner negatives | RESOLVED |
| F04 MINOR | `api/projects.ts:29` | Positive safe versions, year storage bounds, parseable timestamps; twelve ordered Month validation | Giữ runtime validation | 12 Project API transport cases | RESOLVED |
| F05 MINOR | `export-openapi.mjs:14` | Chuẩn hóa CRLF trước so sánh; không bỏ semantic comparison | Giữ newline-only normalization | Nest document/current artifact + generated frontend type check | RESOLVED |
| F06 MINOR | `test-project-rest.mjs:363` | Archive winner phải giữ title đã commit của race trước | Giữ exact `stored.title`/status/version assertions | Real PostgreSQL PATCH/PATCH và PATCH/archive | RESOLVED |
| F07 MINOR | `I05-P06-Implementation-Report.md:9` | Manifest corrected; missing verification doc không được coi là đã merge | Giữ historical 11/11 provenance, actual changed paths và I07 handoff | Git commit manifest, Clock API and live integration evidence | RESOLVED |
| H01 MINOR | `project-detail.tsx:26` | Test native Chromium trước sửa thất bại: Restore xong Archive button không có focus | Sau pending, khôi phục focus vào action hiện tại khi focus bị mất/ở action cũ; không kéo focus khỏi Month người dùng đã chọn | Component check + native 3-engine Restore regression | RESOLVED |
| H02 MAJOR | `project-workspace.tsx:75` | Browser LA còn 2026, backend Ho Chi Minh đã 2027: local current..+2 chặn year 2029; browser test thất bại trước sửa | Client kiểm tra integer/1..9999; backend Clock/timezone tiếp tục quyết định current..+2. Không đổi business rule hoặc API | Mocked boundary regression; live 2026→422 giữ draft, 2029→201 và 12 Months | RESOLVED |
| H03 MINOR | `playwright.config.ts:13` | Hai runner ghi cùng `test-results` làm mất trace (ENOENT) | Tách output/report cho `mocked`, `i04-live`, `i05-live` | Final runs dùng thư mục riêng; assertions giữ nguyên | RESOLVED |

Tác động cross-module: I02 authentication/CSRF/actor-epoch/cache semantics giữ nguyên; I04 publication/presets/availability vẫn do backend quyết định; I07 tiếp tục dùng Project root version và các endpoint riêng. Không có ORM/frontend access, Studio editor, AR/readiness hoặc I09 ordering mới.

## C. D01 — Contract Decision Proposal

**PROPOSED / DECISION REQUIRED.** Nội dung đầy đủ và wording amendment: [I05-Contract-Decisions-PROPOSED.md](I05-Contract-Decisions-PROPOSED.md).

| Approved §16–17 | Actual I05 | Đề xuất |
| --- | --- | --- |
| Project identity/state/baseline/version | Core 10 keys: id/title/year/recipientName/status/version/stylePresetId/baseline/createdAt/updatedAt | Giữ nguyên core projection |
| Detail deletion eligibility | GET detail thêm deletionEligible, server-derived | Giữ; DELETE luôn recheck |
| Ordered Months | Endpoint `/projects/{id}/months`, không embedded | Ghi rõ separate resource gồm 12 summaries + projectVersion |
| Personal events | Chưa triển khai | I07 mở rộng qua endpoint đã hoạch định |
| AR/current readiness/preview | Chưa triển khai | I07/I08 mở rộng; không trả mock readiness |

Khuyến nghị: phê duyệt staged projection bằng amendment tối thiểu; không đổi `/api/v1`, wire shape, DTO hiện tại hoặc schema. Mở rộng tương lai phải additive và regenerate types trong PR tương ứng. Creation-outcome replay v1 giữ ổn định; không thêm required fields làm hỏng stored outcomes cũ. Client ghép child resources chỉ khi root versions nhất quán.

Lead/API owner cần chốt wording, milestone mapping, compatibility của replay và approval record. Task này không áp dụng amendment vào authoritative API Contract.

## D. D02 — Legacy Replay Investigation

### Nguồn gốc / code lineage

- I01 `92d339f` tạo nullable JSONB safe_result. Prisma `Json?`; không có backfill.
- P02 `0cd2a0f` bỏ safeResult khi ghi PROJECT_CREATE → SQL NULL. P03 initial `02e1834` dùng writer đó.
- P03 fix `ed6888e` (2026-11-05 21:08:57 +07) bắt đầu ghi safe creation body atomically và đọc bắt buộc stored view. Không có migration dữ liệu đi kèm.
- First-parent dev merge P03 `c7af6aa` (22:17:44 cùng ngày) đã gồm safe writer. P02 merge trước đó có application port nhưng chưa có Project REST controller. **Nếu** chỉ deploy merged dev, public REST đầu tiên đã an toàn; Git không chứng minh thực tế deployment hoặc không có internal calls.
- Seed thường không tạo PROJECT_CREATE intent. Fixture Project trực tiếp không tương đương idempotency record. Current writer luôn lưu body; legacy upgrade gap vẫn có nếu một môi trường đã nhận old writer/internal calls hoặc restore old snapshot.

### Inventory evidence

Không có deployment/shared DB nào được cấp quyền inventory trong task này. Không đọc `.env` để dò DB và không truy cập production/shared DB.

Đã chuẩn bị và thực thi kiểm chứng [inventory-project-replay.sql](../backend/scripts/inventory-project-replay.sql) **chỉ trên disposable fixtures**. SQL dùng REPEATABLE READ / READ ONLY, bounded timeouts, ROLLBACK; không output key/digest/body/actor/title/credential. Test fingerprint trước/sau và transaction mode chứng minh không đổi records.

| Run | Scope | SQL NULL | Object payloads | Total | Read-only / unchanged |
| --- | --- | ---: | ---: | ---: | --- |
| Final DB suite | Disposable fixture | 1 cố ý tạo | 11 | 12 | PASS |
| Final live suite | Disposable fixture, có New Year case | 1 cố ý tạo | 14 | 15 | PASS |
| Deployment/demo/shared environments | Không có quyền/phạm vi inventory | UNVERIFIED | UNVERIFIED | UNVERIFIED | Không chạy |

Object count không có nghĩa mọi object là original outcome hợp lệ; cần validate shape và provenance. Không suy Case A từ các số liệu fixture trên.

### A/B/C và remediation

| Case | Evidence bắt buộc | Phương án | Approval |
| --- | --- | --- | --- |
| A: không có legacy cần hỗ trợ | Aggregate inventory mọi environment + deployment lineage/cutover | Không tạo data migration; lưu scope/snapshot và giữ regression | Lead xác nhận scope |
| B: có trusted exact original outcome | Binding actor/key/digest/resource + nguồn original response/consistent backup được chứng minh | Bounded guarded backfill safe_result, validate DTO, verify replay; không đổi root/order/month | Lead + DB owner duyệt trước mọi data write |
| C: không thể tái dựng original | Records thiếu outcome, đã edit/archive/delete hoặc lịch sử không đủ | Giữ fail-closed; không duplicate, fake body hoặc dùng current Project; đề xuất operator reconciliation/error contract riêng | DECISION REQUIRED trước đổi HTTP/code/retry semantics |

Case B plan trong proposal có backup/restore, guarded transaction/batch, concurrency checks, limited evidence store và rollback. Không có executable remediation/backfill hoặc migration mới trong PR. Current replay semantics vẫn trả safe 500 cho legacy fixture; passing characterization không làm legacy replay thành compliant. Không biết distribution của deployment, nên D02 vẫn mở.

Operator instructions: chỉ sau khi được cấp scope, dùng managed service kết nối và `psql service=<approved-service> -X -v ON_ERROR_STOP=1 -f backend/scripts/inventory-project-replay.sql`; lưu SQL hash, snapshot, scope và aggregate counts đã redact. Không đưa connection strings/passwords vào command history/PR. Chi tiết trong proposal.

## E. Test Execution

Node 24.21.0, pnpm 11.22.0, PostgreSQL 17.11 disposable, Windows. Không có assertion hoặc original test timeout nào bị làm yếu để lấy PASS.

| Command thực tế | Layer | Result | Evidence local | Limitation |
| --- | --- | --- | --- | --- |
| `pnpm typecheck` | Both apps | PASS | `i05-hardening-typecheck-final.log` | Static |
| `pnpm lint` | Both apps/scripts | PASS | `i05-hardening-lint-final.log` | Static |
| `pnpm --dir backend build` và frontend build | Production compilation | PASS | `i05-hardening-backend-build.log`, `i05-hardening-frontend-build-final.log` | Không phải deployed smoke |
| `pnpm --dir backend test -- --runInBand` | Jest | 225 assertions PASS, process exit 1 do Console Ninja teardown import | `i05-hardening-backend-unit.log` | Không báo command PASS |
| `node .cache/i05-hardening/run-jest.mjs` | Jest, config gốc + extension-hook stub riêng | PASS 225/225, exit 0 | `i05-hardening-backend-unit-verified.log` | Temporary local helper; không mock app/framework behavior |
| `node .cache/i05-hardening/run-jest.mjs --e2e` | Nest Supertest | PASS 7/7, exit 0 | `i05-hardening-backend-http-final.log` | Test ports, không real DB |
| `pnpm --dir frontend exec vitest run --maxWorkers=1` | Frontend/component/API | PASS 127/127, exit 0 | `i05-hardening-frontend-unit-final.log` | HTTP fixtures |
| `pnpm --dir backend test:db` | PostgreSQL + API | PASS; 14 Project REST groups và 7 atomic creation groups, I01/I02/I04 regression | `i05-hardening-db-final.log` | Legacy group là characterization, không acceptance của original replay |
| `$env:LUMICAL_I05_LIVE_UI='1'; node backend/scripts/test-project-rest.mjs` | Real browser→Next→Nest→PG | PASS 6/6 live + REST/Clock/inventory, exit 0 | `i05-hardening-live-final.log` | Loopback cookie mode, schema Order fixture |
| `pnpm --dir frontend exec playwright test --project=chromium --project=firefox --project=webkit --workers=1` | Mocked browser suites | PASS 99/99, exit 0; 33 mỗi engine | `i05-hardening-playwright-final.log` | Không tính là live PG |
| `pnpm --dir frontend exec playwright test --project=chromium-visual --workers=1` | Windows visual baseline | PASS 4/4, exit 0; baselines không đổi | `i05-hardening-visual-final.log` | Không thay native manual review |
| `pnpm contract:check` | Current OpenAPI/generated frontend | PASS | `i05-hardening-contract.log` | Không chứng minh D01 được approve |
| `git diff --check` | Whitespace | PASS tại checkpoints; chốt cuối §G | handoff log | Không thay code review |
| `pnpm peers check`; `node --test infra/proxy.test.mjs` | Dependency / gateway | PASS; proxy 1/1 | `i05-hardening-peers.log`, `i05-hardening-proxy.log` | Không phải production Compose smoke |

Các log trên ở `evidence/`, ignored và không đưa vào PR. NODE_OPTIONS trỏ `evidence/i05-audit-runtime.mjs` ở máy này để bỏ hook Console Ninja đã bị chèn vào installed Nest package. Jest VM không dùng hook Node đó nên dùng mapper riêng cho **đúng extension hook**, giữ nguyên config/tests/transform/application modules. Temporary runner và helper không thuộc PR. Không sửa installed package hoặc đổi dependency.

Một attempt live trước khi tách artifacts thất bại vì runner khác xóa trace cùng output directory; không phải assertion nghiệp vụ. Đã tách `mocked/i04-live/i05-live` output/report và rerun live PASS. Các trước/sau failure của focus và year boundary được giữ trong `i05-hardening-focus-before.log`, `i05-hardening-year-before.log`; targeted focus sau sửa PASS cả ba engines.

### Manual acceptance / checklist

**UNVERIFIED cho native manual screen-reader, toolbar zoom 200% và manual interaction.** Computer Use tool tự dừng vì không xác định được current browser URL đủ tin cậy để enforce policy; không có browser acceptance từ attempt đó. Không tiếp tục app input hoặc bypass policy. Fixture được dừng bằng marker của chính run, Next/backend/owned PostgreSQL đã cleanup.

Skill đã dùng: [computer-use SKILL.md](C:/Users/LENOVO/.codex/plugins/cache/openai-bundled/computer-use/26.1103.32239/skills/computer-use/SKILL.md), có yêu cầu đọc guidance; [guidance.md](C:/Users/LENOVO/.codex/plugins/cache/openai-bundled/computer-use/26.1103.32239/docs/guidance.md) quy định: “If Computer Use reports that the turn ended or that the user stopped Computer Use, stop issuing app input.” Manual runner ban đầu dùng chung label “live Chromium”; label đó trong `i05-hardening-manual.log` chỉ là fixture cleanup, **không** phải browser PASS. Source đã đổi label cho manual mode.

Reproduce bằng synthetic disposable fixture (không dùng tài khoản/DB thật):

1. Build backend; chạy `LUMICAL_I05_MANUAL_UI=1 node backend/scripts/test-project-rest.mjs` với cú pháp env phù hợp shell. Với PowerShell, dùng `$env:LUMICAL_I05_MANUAL_UI='1'` rồi `try { node backend/scripts/test-project-rest.mjs } finally { Remove-Item Env:LUMICAL_I05_MANUAL_UI }` để không giữ manual mode cho các lệnh sau. Khi log MANUAL xuất hiện, đọc `.cache/i05-hardening/manual-session.json`; chỉ mở origin loopback `http://127.0.0.1:3211` của run này.
2. Login owner fixture `owner@example.invalid`, passphrase TEST ONLY đã định nghĩa trong test script. Không lưu password vào browser. Mở `projectUrl` từ metadata; đây là ordered-history fixture nên Delete phải vắng.
3. Chọn VI/EN và light/dark. Qua menu browser hoặc Ctrl+Plus, tăng **native browser zoom đến 200%**, xác nhận giá trị toolbar; không dùng CSS transform/text-size làm thay thế. Kiểm tra title/recipient/year, 12 tháng, actions và dialog không bị che/cắt, không scroll ngang bắt buộc để đọc.
4. Keyboard-only: Tab tới Archive/Restore; Enter mở dialog; initial focus phải Cancel; Tab/Shift+Tab giữ trong modal; Escape hủy và không gửi mutation. Mở lại, xác nhận; trong lúc pending không gửi action thứ hai. Sau response/refresh, focus phải tới action hiện tại. Nếu người dùng đã chọn Month trong pending, focus ở Month được giữ.
5. Tại month tabs: ArrowLeft/Right wrap; Home/End tới tháng 1/12; panel announcement/name khớp; mọi tháng truy cập được. Lặp ở 200% và hai locale/themes, kiểm tra visible focus.
6. Với NVDA/Narrator/VoiceOver được người kiểm thử cấu hình: xác nhận heading/landmarks, 12 tab names/selection, empty Month caption, dialog name/description, cancel-first focus, archived read-only status, year field error/summary, 412 announcement và focus return. Lưu reader/browser/OS/version và kết quả nghe thực tế; accessibility tree/axe không thay bằng chứng âm thanh.
7. New Year: automated live case cố định backend Clock `2026-12-31T17:00Z` tại Ho Chi Minh (2027), browser LA (2026). Manual tester có thể chạy live spec headed/debug để quan sát hoặc tái hiện hai current-year contexts bằng test clocks. Xác nhận 2026 bị backend 422 giữ draft, 2029 tới backend và tạo 201; không sửa system clock/production config. Native manual case vẫn phải được ghi riêng với kết quả thực tế.
8. Kết thúc: tạo đúng `stopFile` trong metadata của run (verify path nằm trong `.cache/i05-hardening`); script dừng child frontend, app và container có ownership label. Deadline 15 phút tự kết thúc fixture nếu chưa có marker. Không prune Docker hoặc dừng services khác.

## F. I05 Acceptance Matrix

| Requirement | Kết quả | Boundary |
| --- | --- | --- |
| I05-P01 | PASS | Domain identity/owner/lifecycle/version/delete policies |
| I05-P02 | PARTIAL | Current atomic creation/rollback/concurrency PASS; D02 deployment compatibility mở |
| I05-P03 | PARTIAL | Owner REST/ETag/security/lifecycle PASS; D01 staged DTO và D02 chưa approve |
| I05-P04 | PASS automated | Create/reopen/draft/privacy/retry và New Year server-authority regression |
| I05-P05 | PARTIAL | Automated 12 Months/dialog/412/focus/themes/reflow PASS; native manual common gate chưa xong |
| I05-P06 | PARTIAL | DB/API/live/Clock/child-version handoff có bằng chứng; D01/D02 và manual gate vẫn mở |
| BR-PRJ-001 | PASS | Active owner, non-transferable; cross-owner safe 404 |
| BR-PRJ-002 | PASS automated | Backend current..+2/Clock/name constraints; old Project remains valid; browser zone không tự chặn eligible year |
| BR-PRJ-003 | PASS | Exactly 12 Months atomically, 1..12 unique/order |
| BR-PRJ-004 | PASS | Private Working initial, không Paid/Ordered Project state |
| BR-PRJ-005 | PASS I05 | Archive read-only/restore; existing share management chưa phải feature proof |
| BR-PRJ-006 | PASS I05 | Trusted any-Order history, cancelled fixture chặn DELETE; no-order delete giữ account media |
| BR-PRJ-007 | PASS | Versioned identity/style edits, immutable year/owner/baseline; ordered Working editable |
| INV-01/03 | PASS I05 | Owner FK + active-account use case + owner-scoped SQL/API negatives |
| INV-02 | PASS I05 | Exact 12 + constraints/atomic rollback; snapshot feature là I09 |
| INV-11 | PASS I05 | Active complete published Template, baseline/price survival |
| INV-14 | PASS I05/schema fixture | History-safe deletion; không chứng minh toàn bộ Order placement/retention pipeline |
| T01 | PASS | Owner isolation/non-transferable |
| T02 | PASS | Inactive Template chặn new intent |
| T03 | PASS | Captured baseline tồn tại qua publication/deactivation |
| T04 | PASS Project / PARTIAL full scenario | Atomic twelve Project Months; Order snapshot acceptance thuộc I09 |
| T24 | PASS I05/schema fixture / PARTIAL full scenario | Cancelled history rejects DELETE, media retained; real I09/I06 workflow ngoài scope |

## G. PR Handoff

PR title: **fix(i05): harden project lifecycle, privacy and integration**.

Suggested commit (chưa tạo): `fix(i05): harden project lifecycle, privacy and integration`.

PR description hoàn chỉnh: [I05-Hardening-PR.md](I05-Hardening-PR.md). Allowlist: `I05-Hardening-Manifest.json`. Review patch chỉ gồm allowlist được chuẩn bị tại `.cache/i05-hardening/i05-hardening-review.patch`; không stage toàn repo. Giữ nguyên 16 file cũ; runtime loader riêng máy không nằm trong PR. Hash và reverse-apply check được ghi ở addendum khi hoàn tất.

API/DB compatibility: additive PATCH CORS; core wire DTO và error/replay semantics không đổi; không migration/schema/backfill/dependency/generated changes. Frontend year-window eligibility luôn do backend Clock quyết định, không phải rule mới. Rollback code không xóa/repair data và không được quay writer về trước `ed6888e`; revert hardening sẽ làm mất các protection đã thêm.

Pending approvals tách riêng: D01 amendment, D02 environment inventory/case selection/remediation nếu cần; teammate/Lead review và manual acceptance. Không có unapproved remediation lẫn trong source changes.

## H. Final Verdict / execution addendum

**PR Hardening: RECOMMEND APPROVE** cho allowlist source/tests/evidence/proposals; cần teammate/Lead review như workflow, không phải merge approval tự động.

**I05 Milestone: NEEDS VERIFICATION**. D01 chưa có explicit approval; D02 chưa có inventory các deployment cần hỗ trợ; manual screen-reader/zoom/interaction chưa được thực hiện thành công. Không tự đánh dấu VERIFIED/DONE hoặc READY FOR LEAD ACCEPTANCE.

Final outcomes: backend Jest 225/225 và HTTP 7/7 với exit 0; Vitest 127/127; full three-engine browser 99/99; live Chromium 6/6; visual 4/4; static/build/contract/peers/proxy PASS. Full DB gate gồm **77 assertion groups** (20 I01, 23 I02, 13 I04, 7 Project creation, 14 Project REST), 5 owned-container cleanups và 3 completion markers; không coi 85 log markers là 85 feature tests. Không có skip/mock đổi thành real DB proof.

Final Git: 15 tracked files modified (**366 insertions, 45 deletions**), 7 new files được đề xuất trong PR; tổng allowlist **22 files**. 16 untracked cũ và một machine-specific runtime helper được giữ nhưng loại khỏi PR. Không staged changes; HEAD giữ nguyên. `git diff --check`, secret-pattern scan, manifest/scope check, hash preservation và reverse-apply patch check được ghi trong handoff log/validation artifact. Local patch không gồm logs, credentials thật, build output hoặc generated artifacts.

Không chạy lại `pnpm verify` như một lệnh monolithic vì cần tách worker/instrumentation; các component gates đã chạy riêng. Hosted CI, production Compose/HTTPS smoke và native manual acceptance không được báo PASS. Không có data remediation hoặc authoritative contract amendment trong branch này.
