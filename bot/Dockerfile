# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY bot/package.json ./bot/
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/

RUN npm ci

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY bot/ ./bot/

# Compile — output goes to bot/dist/bot/src/ and bot/dist/shared/
RUN npx --workspace=bot tsc

# ---- Stage 3: Production runtime ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 botuser

# Copy root node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./

# Copy compiled output (includes bot/src and shared in the dist tree)
COPY --from=builder /app/bot/dist ./bot/dist
COPY --from=builder /app/bot/package.json ./bot/

RUN chown -R botuser:nodejs /app

USER botuser

EXPOSE 4000

# Entry point is bot/dist/bot/src/index.js because rootDir is ".."
CMD ["node", "bot/dist/bot/src/index.js"]
