# Backend Dockerfile
# =====================================================================
# GitHub Copilot assisted Dockerfile
# Multi-stage build to keep image lean and secure
# =====================================================================

# Stage 1: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package manifests first for better caching
COPY package.json package-lock.json ./

# Install dependencies (production only to reduce image size)
RUN npm ci --only=production

# Copy application source
COPY . .

# Optional build step (transpilation, bundling, etc.)
# For now, code runs directly without build
# RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Copy production node_modules and source from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Environment variables
ENV NODE_ENV=production

# Expose backend port
EXPOSE 5000

# Use npm start for consistency with package.json scripts
CMD ["npm", "start"]
