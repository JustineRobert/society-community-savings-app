# Backend Dockerfile
# Multi-stage build to keep image lean

FROM node:18-alpine AS builder
WORKDIR /app

# copy package manifests
COPY package.json package-lock.json ./

# install dependencies (production only helps reduce size)
RUN npm ci --only=production

# copy entire source
COPY . .

# build step (if you have transpilation, etc.)
# for now, nothing to build since code runs directly

FROM node:18-alpine
WORKDIR /app

# copy production modules and source from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "server.js"]
