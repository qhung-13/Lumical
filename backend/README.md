# LumiCal backend

See the [root README](../README.md) for pinned tools, installation, environment
files, Docker and the shared quality gate.

From the repository root:

```sh
pnpm dev:backend
pnpm --dir backend test
pnpm --dir backend test:e2e
```

Development loads an optional `backend/.env` using Node's native env-file support.
`PORT` defaults to 3001; the server listens on `0.0.0.0` for container access.
All REST routes use `/api/v1`; `GET /api/v1/health` returns
`{"status":"ok","service":"lumical-backend"}`. It is a technical liveness check.

`src/modules/health` is the only module at I00. `src/common` holds future shared
technical code; `src/config` holds app configuration. Future business modules use
the interface/application/domain/infrastructure boundaries from
[Backend Standards](../docs/BACKEND_STANDARDS.md) and
[Architecture](../docs/ARCHITECTURE.md).

DB/Prisma (I01), auth (I02), AR technology selection (I03) and provider integrations
remain deferred. There are no runtime OpenAPI endpoints at this stage.
