FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install yt-dlp --break-system-packages && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV YT_DLP_PATH=/usr/local/bin/yt-dlp

COPY --from=build /usr/src/app /usr/src/app
WORKDIR /usr/src/app

EXPOSE 8080
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
