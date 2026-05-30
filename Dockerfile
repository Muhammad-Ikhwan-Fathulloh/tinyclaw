# TinyClaw — one container: API, web dashboard, automation + task workers
# Build: docker build -t tinyclaw .
# Run:   docker run -d -p 4310:4310 -v tinyclaw-data:/app/data -v tinyclaw-config:/root/.tinyclaw tinyclaw

FROM oven/bun:1.3-debian
WORKDIR /app

COPY package.json bun.lock ./
COPY apps apps
COPY packages packages

RUN bun install --frozen-lockfile \
  && bun run --filter @tinyclaw/web build \
  && mkdir -p data/sqlite data/automations data/logs

ENV NODE_ENV=production \
    TINYCLAW_HOST=0.0.0.0 \
    TINYCLAW_PORT=4310 \
    DATABASE_URL=file:data/sqlite/tinyclaw.sqlite

EXPOSE 4310

VOLUME ["/app/data", "/root/.tinyclaw"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:4310/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "apps/server/src/index.ts"]
