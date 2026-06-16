FROM node:22-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && pnpm --version

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY lib/ ./lib/
COPY artifacts/api-server ./artifacts/api-server
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @workspace/api-server run build

FROM base
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install yt-dlp --break-system-packages && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV YT_DLP_PATH=/usr/local/bin/yt-dlp

COPY --from=build /app /app

EXPOSE 8080
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
