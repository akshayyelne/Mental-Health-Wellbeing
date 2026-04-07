# ── Stage 1: install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install || (npm install --no-package-lock && npm install)

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Declare the build arg so Next.js can bake it into the JS bundle
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: minimal runtime ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# next.config.ts output: "standalone" produces a self-contained server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
# public/ may be empty — create the target dir first so COPY never fails
RUN mkdir -p ./public
COPY --from=builder /app/public/          ./public/

EXPOSE 3000
CMD ["node", "server.js"]
