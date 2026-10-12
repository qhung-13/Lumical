# syntax=docker/dockerfile:1

FROM node:24.21.0-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable \
  && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app


FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json

RUN pnpm install \
  --frozen-lockfile \
  --filter @lumical/frontend...


FROM deps AS build

COPY frontend ./frontend

RUN pnpm --dir frontend build


FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json

RUN pnpm install \
  --frozen-lockfile \
  --prod \
  --filter @lumical/frontend...

COPY --from=build --chown=node:node /app/frontend/.next ./frontend/.next
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public

USER node

EXPOSE 3000

CMD ["pnpm", "--dir", "frontend", "start"]