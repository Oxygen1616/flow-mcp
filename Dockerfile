FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
COPY studio/ ./studio/
RUN npm run build

# whisper.cpp: hears the words for flow_transcribe and flow_captions.
# Built for any x86-64 CPU with AVX but without AVX2/FMA, so it also runs on older home servers
# (an Ivy Bridge i7 has AVX and F16C only); a build tuned to the CI machine would crash there.
FROM debian:bookworm-slim AS whisper
ARG WHISPER_VERSION=v1.9.4
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "${WHISPER_VERSION}" https://github.com/ggml-org/whisper.cpp /whisper \
    && cmake -S /whisper -B /whisper/build \
       -DCMAKE_BUILD_TYPE=Release \
       -DBUILD_SHARED_LIBS=OFF \
       -DWHISPER_BUILD_TESTS=OFF \
       -DGGML_NATIVE=OFF \
       -DGGML_AVX=ON \
       -DGGML_AVX2=OFF \
       -DGGML_BMI2=OFF \
       -DGGML_FMA=OFF \
       -DGGML_F16C=ON \
    && cmake --build /whisper/build --config Release --target whisper-cli -j"$(nproc)" \
    && cp /whisper/build/bin/whisper-cli /usr/local/bin/whisper-cli

# Runtime Stage
FROM node:22-bookworm-slim

# ffmpeg: assembling and narration. chromium + fonts: drawing caption lettering (flow_captions).
# python3 + libsndfile: the offline Kokoro voice (flow_narrate engine "kokoro"). libgomp1: whisper-cli threads.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    procps \
    ca-certificates \
    curl \
    chromium \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    python3 \
    python3-venv \
    libsndfile1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# The container runs as root, which Chromium refuses without --no-sandbox; Debian's chromium wrapper reads this file.
# Docker's small /dev/shm also crashes Chromium, so it uses /tmp instead.
RUN printf 'export CHROMIUM_FLAGS="$CHROMIUM_FLAGS --no-sandbox --disable-dev-shm-usage"\n' > /etc/chromium.d/flow-mcp

COPY --from=whisper /usr/local/bin/whisper-cli /usr/local/bin/whisper-cli

# Kokoro: its own Python environment, and the v1.0 model baked in (about 350 MB) so the voice works offline at once.
# kokoro_speak.py carries a fix written for kokoro-onnx 0.4.7, so that version is pinned.
RUN python3 -m venv /opt/kokoro-venv \
    && /opt/kokoro-venv/bin/pip install --no-cache-dir kokoro-onnx==0.4.7 soundfile numpy \
    && mkdir -p /opt/kokoro \
    && curl -fsSL -o /opt/kokoro/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx \
    && curl -fsSL -o /opt/kokoro/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/studio ./studio
COPY scripts/ ./scripts/

ENV NODE_ENV=production
ENV FLOW_MCP_PORT=8787
ENV FLOW_MCP_BIND=0.0.0.0
ENV FLOW_MCP_HOME=/data/.flow-mcp
ENV FLOW_MCP_ALLOW_HOSTS=umbrel.local:8787,localhost:8787,127.0.0.1:8787
ENV FLOW_MCP_CHROME=/usr/bin/chromium
ENV FLOW_MCP_WHISPER=/usr/local/bin/whisper-cli
ENV FLOW_MCP_PYTHON=/opt/kokoro-venv/bin/python
ENV FLOW_MCP_KOKORO_DIR=/opt/kokoro

# Fail the build, not the first caption or narration, if a tool is missing or broken.
RUN whisper-cli --help > /dev/null 2>&1 \
    && chromium --headless --no-sandbox --disable-gpu --dump-dom about:blank > /dev/null 2>&1 \
    && echo "Kokoro works." > /tmp/k.txt \
    && /opt/kokoro-venv/bin/python scripts/kokoro_speak.py /opt/kokoro /tmp/k.txt /tmp/k.wav am_puck 1 \
    && test -s /tmp/k.wav \
    && rm -f /tmp/k.txt /tmp/k.wav

VOLUME ["/data"]

EXPOSE 8787

CMD ["node", "dist/index.js"]
