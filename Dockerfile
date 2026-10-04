# syntax=docker/dockerfile:1
# One image: the API serves the built web app, so there is a single origin (cookies stay first-party, no CORS).
# Build context is the repo root. No secrets are read at build time.
# The API is bundled into one file, so the runtime image contains no node_modules and no dev dependencies.

ARG BUN_IMAGE=oven/bun:1-slim

# Build stage: full install from the frozen lockfile. Nothing from here ships except the build outputs.
FROM ${BUN_IMAGE} AS build
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
RUN bun install --frozen-lockfile --filter @job-tracker/api --filter @job-tracker/web

COPY apps/api apps/api
COPY apps/web apps/web
# Optional and public: only set when the API lives on a different origin than the page.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN cd apps/api && bun run build && cd ../web && bun run build

FROM ${BUN_IMAGE} AS runtime
ENV NODE_ENV=production \
    BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 \
    DATABASE_URL=/data/app.db \
    WEB_DIST=/app/web \
    MIGRATIONS_DIR=/app/drizzle
WORKDIR /app

COPY --from=build /app/apps/api/dist/server.js ./server.js
COPY --from=build /app/apps/api/drizzle ./drizzle
COPY --from=build /app/apps/web/dist ./web

# Platform volumes are mounted root-owned. The entrypoint fixes ownership of /data,
# then drops to the unprivileged `bun` user before the app starts.
COPY --chmod=755 <<'EOF' /usr/local/bin/entrypoint.sh
#!/bin/sh
set -eu
if [ "$(id -u)" = "0" ]; then
  mkdir -p /data
  chown -R bun:bun /data
  export HOME=/home/bun
  exec setpriv --reuid=bun --regid=bun --init-groups "$@"
fi
exec "$@"
EOF
RUN mkdir -p /data && chown bun:bun /data
VOLUME /data

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bun", "server.js"]
