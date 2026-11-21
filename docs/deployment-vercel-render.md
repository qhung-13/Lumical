# Demo học thuật: Vercel + Render

## Nguyên nhân và quyết định transport

Kiểm tra ngày 2026-11-21: Vercel `/api/v1/auth/session` trả Next 404,
`X-Matched-Path: /_not-found`; Render session và Template Catalog trả 200 trực
tiếp. Production không chạy gateway `infra/proxy.mjs`, còn Next chỉ có rewrite
development và route health. Gateway cũ không có xác thực bằng khóa; giả định
socket/IP cố định của Compose không áp dụng cho hai nền tảng này.

Route Node.js `frontend/src/app/api/[...path]/route.ts` chuyển HTTP tới duy nhất
origin HTTPS trong `BACKEND_URL`. Nest tiếp tục sở hữu session, đăng ký, đăng
nhập, phân quyền, CSRF, idempotency và nghiệp vụ. Không bật rewrite development
trong production. Gateway dùng chung kiểm tra origin, lọc hop headers, deadline
và error envelope với gateway socket trong `infra/`.

Khóa `LUMICAL_GATEWAY_KEY` xác thực gateway/SSR với Nest; **không thay thế**
account cookie, Origin, CSRF hay quyền Admin. Render bắt buộc khóa mạnh ngay khi
khởi động. Ngoại lệ không cần khóa chỉ là GET/HEAD trên đúng ba đường dẫn health.
Backend xóa credential header trước khi chuyển tới controller. Khóa không đi
vào props, response hoặc log. Không dùng tiền tố `NEXT_PUBLIC_`.

## IP nguồn và rate limit I02

[Vercel ghi đè IP header tại edge để chống spoofing](https://vercel.com/docs/headers/request-headers).
Gateway chỉ nhận một IP hợp lệ trong `x-vercel-forwarded-for`, yêu cầu runtime
`VERCEL=1`, xóa mọi proxy metadata của caller và tự tạo `X-Lumical-Client-IP` cùng
credential riêng. Nest chỉ dùng IP riêng sau khi xác thực khóa; không tin chuỗi
XFF/socket động của Render và không bật `trust proxy=true`/CIDR/số hop.
SSR GET session có thể không gửi IP; các business request khác bắt buộc có IP.

Đây là thay đổi cơ chế chứng thực IP: từ socket gateway riêng sang IP edge do
Vercel chứng thực rồi truyền qua kết nối có khóa. Không triển khai adapter này
trên host khác bằng cách tự đặt `VERCEL=1`, không đặt proxy/CDN tùy ý trước Vercel
và không cho preview không tin cậy sử dụng khóa production.

Giữ một tiến trình/instance Nest cho demo. Limiter IP và normalized-email vẫn
process-local, có capacity/window như I02; restart xóa bộ đếm. Nhiều instance cần
quyết định riêng về limiter dùng chung. Người dùng chung NAT vẫn chung quota IP.
Nếu cần đảm bảo socket-source nguyên bản xuyên toàn bộ chuỗi proxy, hoặc giới
hạn toàn cục qua nhiều instance: **DECISION REQUIRED**, topology hiện tại không
đảm bảo hai yêu cầu đó. Các yêu cầu này không phải baseline limiter process-local.

## Redeploy chính xác

Chuẩn bị secret trước khi merge PR để auto-deploy không chạy với cấu hình thiếu.
Tạo một khóa ngẫu nhiên 32 byte, biểu diễn bằng 64 ký tự hex, qua công cụ secret
tin cậy; dùng cùng giá trị trên hai nền tảng, khác `IDENTITY_SECRET_KEY`. Không đưa
giá trị vào lệnh curl, PR, screenshot hoặc log build. Đổi khóa cần cập nhật cả hai
bên và redeploy đồng bộ.

### Render: service `lumical`

1. Giữ nguyên Neon, `DATABASE_URL`, các secret identity/provider, pipeline
   migration hiện có và mọi cấu hình database. PR này không có migration mới.
2. Environment, lưu các giá trị sau trước khi deploy commit đã review:

   | Biến | Giá trị |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `IDENTITY_COOKIE_MODE` | `https` |
   | `IDENTITY_ALLOWED_ORIGINS` | `https://lumical-lovat.vercel.app` |
   | `IDENTITY_TRUSTED_PROXY_IPS` | chuỗi rỗng |
   | `LUMICAL_GATEWAY_KEY` | khóa mới, giống Vercel |

   Giữ `IDENTITY_SECRET_KEY` hiện có để không đổi digest/session. Render tự đặt
   [`RENDER=true`](https://render.com/docs/environment-variables); thiếu/sai khóa
   làm startup thất bại, health không che được lỗi cấu hình.
3. Deploy từ commit của PR sau khi merge vào protected `main` qua review bình
   thường. Nếu dùng Node runtime với Root Directory là repo root: Build Command
   `pnpm install --frozen-lockfile && pnpm --dir backend build`; Start Command
   `node backend/dist/main.js`. Nếu đang dùng Docker, giữ `backend/Dockerfile`,
   target runner và repo-root build context hiện có. Node phải khớp `.nvmrc`/
   `package.json` (24.21.0 trong baseline này).
4. Health Check Path: `/api/v1/health/ready`. Chạy một instance, một tiến trình
   backend. Manual Deploy → Deploy latest commit nếu auto-deploy chưa chạy.
5. Xác nhận health/live và health/ready 200; direct GET session, templates và
   admin/templates phải **403**, kể cả với Origin hoặc forwarding header giả.

### Vercel: project `lumical-lovat`

1. Production Branch: `main`; Framework: Next.js; Root Directory: `frontend`.
   Bật **Include files outside of the root directory in the Build Step** để
   bundler đọc các module HTTP dùng chung trong `infra/` và workspace lockfile.
2. Giữ package manager pnpm 11.22.0 từ root `package.json`; Install Command
   `pnpm install --frozen-lockfile`; Build Command `pnpm build` (chạy trong
   `frontend`); Output Directory mặc định của Next; Node 24.x phù hợp engines.
3. Environment Variables, scope **Production**:

   | Biến | Giá trị |
   | --- | --- |
   | `BACKEND_URL` | `https://lumical.onrender.com` (không slash cuối/path/query) |
   | `LUMICAL_GATEWAY_KEY` | cùng khóa Render |

   Không tự đặt `VERCEL`: nền tảng cung cấp giá trị này. Không đặt gateway key
   trong `next.config.env`, `NEXT_PUBLIC_*`, client props hoặc biến Preview.
   `ACCOUNT_COOKIE_NAME` không cần trong production; cookie luôn là `__Host-`.
4. Sau khi Render chạy bản mới và bước direct-denial PASS, redeploy commit mới
   trên Production. Thay đổi env chỉ có hiệu lực ở deployment mới. Không chọn
   lại deployment cũ chứa mã chưa sửa.
5. Kiểm tra các bước acceptance dưới đây trên domain production chính xác.

## Acceptance sau deploy

Không gửi gateway key từ trình duyệt/curl. Các lệnh đọc an toàn:

```sh
curl -i https://lumical.onrender.com/api/v1/health/live
curl -i https://lumical.onrender.com/api/v1/health/ready
curl -i https://lumical.onrender.com/api/v1/auth/session
curl -i https://lumical.onrender.com/api/v1/templates
curl -i https://lumical-lovat.vercel.app/api/v1/auth/session
curl -i 'https://lumical-lovat.vercel.app/api/v1/templates?category=GENERAL&limit=1'
```

Kỳ vọng: lần lượt 200, 200, 403, 403, 200 và 200; hai API qua Vercel trả JSON,
`Cache-Control: no-store`, không còn `/_not-found`. Catalog có dữ liệu thực theo
seed hiện có. Kiểm tra Network/Storage bằng tài khoản demo tổng hợp: đăng ký,
đăng nhập, refresh session, logout, cookie cũ bị 401; cookie Secure/HttpOnly/
SameSite=Lax/Path=/ và không Domain. Không lưu raw cookie/CSRF trong ảnh bằng chứng.

User thường truy cập API Admin phải 403; Admin được cấp quyền qua quy trình vận
hành hiện có mới thành công. Mutation thiếu/sai CSRF hoặc Origin phải 403. Không
cấp Admin qua đăng ký và không sửa role của người dùng production để smoke test.

Trên môi trường demo/staging dùng riêng, kiểm tra IP qua Vercel: cạn 50 lần đăng
nhập sai với các email tổng hợp khác nhau từ A; yêu cầu tiếp theo phải 429 dù đổi
`X-Forwarded-For`, `X-Real-IP`, `X-VerCel-Forwarded-For` hay `X-Lumical-Client-IP`.
Nguồn mạng B vẫn đăng nhập hợp lệ được. Đây là hosted acceptance bắt buộc cho trust
edge; fixture local tự mô phỏng header nền tảng nên không chứng minh cấu hình
edge đang chạy. Không thêm endpoint debug IP/secret để làm bước này.

## Kiểm thử và giới hạn

- `pnpm test:proxy`: regression HTTP của cả hai adapter.
- `pnpm test:gateway`: build backend/Next production, chạy toàn bộ I02 với
  PostgreSQL dùng một lần, rồi kiểm chứng gateway Next thực qua HTTPS cục bộ.
  Cần Docker và OpenSSL; Windows có thể đặt `OPENSSL_BIN` tới openssl.exe.
- `pnpm --dir frontend exec vitest run --maxWorkers=1`, backend unit/e2e,
  `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm contract:check`.

Integration mới kiểm tra register/login/session/logout/revocation, SSR không lộ
secret, Catalog/query validation, Admin 401/403/200, Origin/CSRF, role injection,
malformed JSON, nhiều Set-Cookie với Expires, binary body, redirect/network failure
và quota IP riêng dù caller giả proxy header. CI chạy gate mới sau `pnpm verify`.
Các container/certificate/Next process của fixture được dọn theo ownership.

Kết quả local ngày 2026-11-21: backend Jest 388/388 và 4/4 media policy gates;
HTTP e2e 7/7; frontend Vitest 173/173 với một worker; gateway 26/26; 23 nhóm I02
PostgreSQL và nhóm Next production/TLS mới đều PASS. Lint, typecheck, hai production
build, contract drift, peer check, diff check và build/import smoke của image socket
gateway đều PASS. Không thay test/timeout để che ba timeout UI khi chạy nhiều
tiến trình ở lần đầu. Chưa chạy toàn bộ `pnpm verify`, hosted CI hoặc hosted acceptance.

Next được nâng bản vá 16.4.1 → 16.4.5 cùng ESLint config theo
[security release chính thức](https://nextjs.org/blog/november-2026-security-release).
Đây không phải đợt nâng toàn bộ dependency. Các advisory production khác cần được
đánh giá theo dependency/reachability riêng; báo cáo `pnpm audit` không đồng nghĩa
đã chứng minh exploit. Không tuyên bố toàn hệ thống không còn advisory.
Audit ngày 2026-11-21 sau bản vá: 11 advisory còn lại (5 high, 4 moderate, 2 low)
trong deepmerge-ts, mysql2, body-parser, multer, fast-uri, qs và effect; Next không
còn advisory trong kết quả này. Đây là nợ dependency có sẵn, cần review riêng
trước khi mở triển khai ngoài phạm vi demo học thuật.

Vercel có giới hạn body/duration của Functions; media vẫn upload trực tiếp provider
theo I06. Response media được stream, deadline giữ 30 giây; request còn lại 15
giây; function có budget 60 giây. Cold start Render có thể gây lỗi 502 retryable.
Chưa redeploy hoặc kiểm tra HTTPS browser/edge trên hosted environment chỉ bằng
việc chạy gate local. Không rollback bằng cách gỡ khóa trên Render: điều đó mở
lại đường truy cập business trực tiếp.
