# LumiCal frontend

See the [root README](../README.md) for pinned tools, installation, environment
files, Docker and the shared quality gate.

From the repository root:

```sh
pnpm dev:frontend
pnpm --dir frontend test
pnpm --dir frontend test:watch
```

The App Router owns routing and layout. Future product code belongs in
`src/features`; shared UI, API access and utilities have separate placeholders.
The temporary homepage links to `/api/v1/health`, a server-only, uncached proxy
proof using `BACKEND_URL`. It returns a controlled 502 if Nest is unavailable.

Read [Frontend Standards](../docs/FRONTEND_STANDARDS.md),
[Design System](../docs/DESIGN_SYSTEM.md) and
[Architecture](../docs/ARCHITECTURE.md) before adding code. The Design System and
business features are intentionally deferred.
