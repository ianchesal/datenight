# Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/server.ts ./server.ts
COPY package*.json ./
COPY .env.example ./

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx server.ts"]
