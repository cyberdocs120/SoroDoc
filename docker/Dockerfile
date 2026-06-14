# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json turbo.json ./
COPY packages/ packages/

RUN npm ci --ignore-scripts && \
    npm run build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache tini

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/packages/ packages/

RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/cli/dist packages/cli/dist
COPY --from=builder /app/packages/api/dist packages/api/dist
COPY --from=builder /app/packages/sdk/dist packages/sdk/dist

ENV NODE_ENV=production

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/cli/dist/index.js"]
