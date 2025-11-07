# Development Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies for building (needed for some npm packages)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for development)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Create public directory and build CSS
RUN mkdir -p ./public && npm run build:css

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start the application in development mode
CMD ["npm", "run", "dev"]
