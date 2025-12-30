# ==============================================================================
# STAGE 1: Dependencies
# ==============================================================================
# This stage installs all dependencies (both production and development)
# We use Alpine Linux for a smaller image size (~40MB vs ~900MB for regular node)
FROM node:18-alpine AS deps

# Install OpenSSL for Prisma (Prisma needs it to generate the client)
RUN apk add --no-cache libc6-compat openssl

# Set working directory - all commands will run from here
WORKDIR /app

# Copy package files first (Docker caches layers, so if these don't change,
# we can skip reinstalling dependencies on subsequent builds)
COPY package.json package-lock.json ./

# Install dependencies
# --frozen-lockfile ensures we use exact versions from package-lock.json
RUN npm ci --frozen-lockfile

# ==============================================================================
# STAGE 2: Builder
# ==============================================================================
# This stage builds the Next.js application
FROM node:18-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependencies from the deps stage (faster than reinstalling)
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Accept environment variables as build arguments
# These MUST be provided during docker build for client-side env vars to work
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

# Set environment variables for build
# Client-side env vars (NEXT_PUBLIC_*) must be set here to be embedded in the bundle
ENV NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client
# This creates the type-safe database client based on your schema
RUN npx prisma generate

# Build the Next.js application
# This creates an optimized production build in the .next folder
RUN npm run build

# ==============================================================================
# STAGE 3: Runner
# ==============================================================================
# This is the final stage - a minimal image that only contains what's needed to run
FROM node:18-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Don't run as root (security best practice)
# Create a system user and group called 'nodejs'
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only the built application and necessary files
# We don't need source code or build tools in the final image

# Copy public files (images, fonts, etc.)
COPY --from=builder /app/public ./public

# Copy Next.js build output
# Set proper permissions for the nextjs user
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files (needed for migrations)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Switch to non-root user
USER nextjs

# Expose port 3000 (Next.js default port)
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Start the application
# server.js is created by Next.js standalone build
CMD ["node", "server.js"]
