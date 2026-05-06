FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

# ─── API Builder ────────────────────────────────────────────────────────────────
FROM base AS api-builder
WORKDIR /workspace

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/ lib/
COPY scripts/ scripts/
COPY artifacts/api-server/ artifacts/api-server/

RUN pnpm install --frozen-lockfile

WORKDIR /workspace/artifacts/api-server
RUN node ./build.mjs

# ─── API Runtime ────────────────────────────────────────────────────────────────
FROM node:24-slim AS api
WORKDIR /workspace

COPY --from=api-builder /workspace/node_modules/ ./node_modules/
COPY --from=api-builder /workspace/artifacts/api-server/dist/ ./artifacts/api-server/dist/
COPY --from=api-builder /workspace/artifacts/api-server/node_modules/ ./artifacts/api-server/node_modules/

WORKDIR /workspace/artifacts/api-server

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]

# ─── Dashboard Builder ──────────────────────────────────────────────────────────
FROM base AS dashboard-builder
WORKDIR /workspace

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/ lib/
COPY scripts/ scripts/
COPY artifacts/dashboard/ artifacts/dashboard/

RUN pnpm install --frozen-lockfile

WORKDIR /workspace/artifacts/dashboard
ENV BASE_PATH=/
ENV PORT=3000
ENV NODE_ENV=production
RUN pnpm run build

# ─── Nginx (serves dashboard + proxies /api) ────────────────────────────────────
FROM nginx:stable-alpine AS nginx
COPY --from=dashboard-builder /workspace/artifacts/dashboard/dist/public/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
