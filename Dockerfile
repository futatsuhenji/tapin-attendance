# ビルド環境
FROM node:lts-alpine@sha256:c720a25dd3a78e6274d55267e76d89e5c096c46940b5ea83f7a99978feb0b514 AS builder

WORKDIR /app

COPY package.json pnpm-*.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV NEXT_CACHE_DIR=/tmp/next-cache
ENV PORT=3000

COPY . .

RUN pnpm build

# 実行環境
FROM node:lts-alpine@sha256:c720a25dd3a78e6274d55267e76d89e5c096c46940b5ea83f7a99978feb0b514 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_CACHE_DIR=/tmp/next-cache
ENV PORT=3000

COPY --from=builder /app/package.json /app/pnpm-*.yaml ./
RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile
RUN mkdir -p ${NEXT_CACHE_DIR} && chown -R node:node ${NEXT_CACHE_DIR}

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

USER node
EXPOSE ${PORT}

CMD ["pnpm", "start"]
