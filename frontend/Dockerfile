# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace files
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY bot/package.json ./bot/
COPY shared/package.json ./shared/

# Install all deps — npm hoists to /app/node_modules
RUN npm ci

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Disable standalone output for Docker — we'll run next start instead
# This avoids the file tracing issues with hoisted node_modules
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_ vars must be available at build time for Next.js to inline them
ARG NEXT_PUBLIC_TELEGRAM_BOT_NAME=""
ENV NEXT_PUBLIC_TELEGRAM_BOT_NAME=${NEXT_PUBLIC_TELEGRAM_BOT_NAME}
ARG NEXT_PUBLIC_SITE_URL=""
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN npm run build --workspace=frontend

# ---- Stage 3: Production runtime ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

ARG FRONTEND_PORT=3000
ENV PORT=${FRONTEND_PORT}

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy node_modules and built output
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/frontend ./frontend
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.base.json ./

RUN chown -R nextjs:nodejs /app

USER nextjs

ARG FRONTEND_PORT=3000
EXPOSE ${FRONTEND_PORT}

CMD ["npx", "--workspace=frontend", "next", "start"]
