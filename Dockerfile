# Use the official Bun image
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
COPY package.json bun.lock ./
# Note: we don't have a bun.lock yet, but we will generate it. We will copy package.json first.
RUN bun install

# Copy all code and build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run lint || true

# Production image runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Don't run production as root
RUN addgroup --system --gid 1001 bunjs
RUN adduser --system --uid 1001 bunjs
USER bunjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/agents ./agents
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Target agent slug to run (can be overridden at runtime)
ENV AGENT_SLUG="aprovauto-ai"
ENV AGENT_CHANNEL="whatsapp"

# Execute runner script
CMD ["bun", "run", "scripts/run-agent.ts"]
