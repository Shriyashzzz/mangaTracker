# syntax=docker/dockerfile:1
# Production image for the API: build TypeScript, then run plain Node.

FROM node:22-alpine AS base
WORKDIR /app
# openssl is needed by Prisma on alpine
RUN apk add --no-cache openssl

# ---- install everything (dev deps are needed to build) ----
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ---- build: generate the Prisma client, compile to dist/ ----
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY package*.json ./
EXPOSE 8080
# apply any new migrations, then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
