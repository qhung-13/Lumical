# syntax=docker/dockerfile:1

FROM node:24.21.0-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable \
  && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app


FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN pnpm install \
  --frozen-lockfile \
  --filter @lumical/backend...


FROM deps AS build

COPY backend ./backend

RUN pnpm --dir backend build

FROM build AS migration

WORKDIR /app/backend
USER node
CMD ["node", "scripts/prisma.mjs", "migrate", "deploy"]


FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3001

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN pnpm install \
  --frozen-lockfile \
  --prod \
  --filter @lumical/backend...

COPY --from=build /app/backend/dist ./backend/dist

USER node

EXPOSE 3001

CMD ["node", "backend/dist/main.js"]
