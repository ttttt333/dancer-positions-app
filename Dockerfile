# フロントをビルドし、API + dist を1コンテナで配信（同一オリジン）
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/

RUN npm ci && cd server && npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=8080

COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "server/index.mjs"]
