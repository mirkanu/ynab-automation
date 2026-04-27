# Stage 1: Install all dependencies (dev included — needed for Prisma generate + TypeScript build)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma generate must run before build to create the client
RUN npx prisma generate
RUN npm run build 2>&1 || (echo "=== BUILD FAILED ===" && exit 1)

# Stage 3: Production runner — standalone output only
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install curl for healthcheck
RUN apk add --no-cache curl

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and migrations so `prisma migrate deploy` works at startup
COPY --from=builder /app/prisma ./prisma
# Copy Prisma client (generated) — already embedded in standalone output but explicit copy is safe
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Copy prisma CLI so we can run migrate deploy without fetching from npm
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

EXPOSE 3000

# Run Prisma migrations then start the Next.js standalone server
# Use local prisma binary (not npx which fetches latest from npm)
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]
