# Use official Bun image
FROM oven/bun:1.1 as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock tsconfig.json ./
RUN bun install --ci

# Copy source code
COPY src ./src
COPY index.ts ./

# Runtime image
FROM oven/bun:1.1-slim
WORKDIR /app

# Copy from base
COPY --from=base /app /app

# Environment variables (defaults)
ENV NODE_ENV=production
ENV DB_PROVIDER=POSTGRES
ENV CACHE_PROVIDER=REDIS

# Run as a non-root user to comply with Kubernetes Pod Security Standards
RUN addgroup --system pencari && adduser --system --ingroup pencari pencari
USER pencari

# Start the application
CMD ["bun", "run", "index.ts"]
