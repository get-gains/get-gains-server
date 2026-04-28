# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Copy prisma schema for client generation (needed before install due to postinstall)
COPY prisma ./prisma

# Install all dependencies (including devDependencies for build)
ENV HUSKY=0
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN pnpm run build

# Production stage
FROM node:24-alpine AS production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Copy prisma schema BEFORE installing dependencies (needed for postinstall)
COPY prisma ./prisma

# Install only production dependencies, skip scripts (husky is not in prod deps)
ENV HUSKY=0
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Generate Prisma client manually (postinstall is skipped above)
RUN pnpm exec prisma generate

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership to non-root user
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "dist/index.js"]
