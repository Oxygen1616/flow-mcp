FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
COPY studio/ ./studio/
RUN npm run build

# Runtime Stage
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    procps \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/studio ./studio

ENV NODE_ENV=production
ENV FLOW_MCP_PORT=8787
ENV FLOW_MCP_BIND=0.0.0.0
ENV FLOW_MCP_HOME=/data/.flow-mcp
ENV FLOW_MCP_ALLOW_HOSTS=umbrel.local:8787,localhost:8787,127.0.0.1:8787

VOLUME ["/data"]

EXPOSE 8787

CMD ["node", "dist/index.js"]
