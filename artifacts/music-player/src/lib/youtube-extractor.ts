/**
 * Client-side YouTube audio extraction using YouTube's internal Innertube API.
 *
 * On native (Capacitor): CapacitorHttp bypasses CORS — calls YouTube directly
 *   from the device (same IP that will download), just like Snaptube.
 * On web (browser): tries fetch() — will fail CORS in browser, falls back to server.
 */
import { Capacitor } from "@capacitor/core";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YouTubeStreamInfo {
  title: string;
  artist: string;
  duration: number;
  thumbnailUrl: string | null;
  audioUrl: string;
  fileExtension: "m4a" | "webm";
  contentLength: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ─── Innertube request ────────────────────────────────────────────────────────

const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

const CLIENTS = [
  {
    name: "ANDROID",
    version: "19.09.37",
    clientName: "3",
    sdk: 30,
    ua: "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
  },
  {
    name: "ANDROID_VR",
    version: "19.09.37",
    clientName: "38",
    sdk: 30,
    ua: "com.google.android.apps.youtube.vr/19.09.37 (Linux; U; Android 11) gzip",
  },
  {
    name: "ANDROID_EMBEDDED",
    version: "19.09.37",
    clientName: "42",
    sdk: 30,
    ua: "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
  },
  {
    name: "TV",
    version: "2.0",
    clientName: "7",
    ua: "Mozilla/5.0 (ChromiumStylePlatform; Linux; Android 11) AppleWebKit/537.36",
  },
];

function makeContext(client: typeof CLIENTS[number]) {
  const ctx: any = {
    client: {
      clientName: client.name,
      clientVersion: client.version,
      hl: "en",
      gl: "US",
      timeZone: "UTC",
      utcOffsetMinutes: 0,
    },
  };
  if (client.sdk) ctx.client.androidSdkVersion = client.sdk;
  if (client.ua) ctx.client.userAgent = client.ua;
  return ctx;
}

function makeHeaders(client: typeof CLIENTS[number]) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-YouTube-Client-Name": client.clientName,
    "X-YouTube-Client-Version": client.version,
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (client.ua) headers["User-Agent"] = client.ua;
  return headers;
}

async function callInnertube(videoId: string): Promise<InnertubeResponse> {
  let lastErr: Error | null = null;

  for (const client of CLIENTS) {
    try {
      return await tryClient(videoId, client);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastErr ?? new Error("Todos os clients Innertube falharam");
}

async function tryClient(
  videoId: string,
  client: typeof CLIENTS[number]
): Promise<InnertubeResponse> {
  const body = JSON.stringify({ context: makeContext(client), videoId });
  const headers = makeHeaders(client);

  if (Capacitor.isNativePlatform()) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      url: INNERTUBE_URL,
      method: "POST",
      headers,
      data: body,
      responseType: "json",
    });
    if (res.status && res.status >= 400) {
      throw new Error(`Innertube HTTP ${res.status}`);
    }
    if (typeof res.data !== "object" || res.data === null) {
      throw new Error("YouTube retornou HTML em vez de JSON (provável bloqueio)");
    }
    return res.data as InnertubeResponse;
  }

  const res = await fetch(INNERTUBE_URL, {
    method: "POST",
    headers,
    body,
  });
  if (!res.ok) throw new Error(`Innertube HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) {
    throw new Error("YouTube retornou HTML em vez de JSON");
  }
  return res.json() as Promise<InnertubeResponse>;
}

// ─── Format selection ─────────────────────────────────────────────────────────

const PREFERRED: { itag: number; ext: "m4a" | "webm" }[] = [
  { itag: 141, ext: "m4a" },
  { itag: 140, ext: "m4a" },
  { itag: 139, ext: "m4a" },
  { itag: 251, ext: "webm" },
  { itag: 250, ext: "webm" },
  { itag: 249, ext: "webm" },
];

function pickBestAudio(
  formats: AdaptiveFormat[]
): { format: AdaptiveFormat; ext: "m4a" | "webm" } | null {
  const directFormats = formats.filter(
    (f) => f.url && f.mimeType?.startsWith("audio/")
  );

  for (const { itag, ext } of PREFERRED) {
    const fmt = directFormats.find((f) => f.itag === itag);
    if (fmt) return { format: fmt, ext };
  }

  if (directFormats.length > 0) {
    const fmt = directFormats[0];
    const ext = fmt.mimeType?.includes("webm") ? "webm" : "m4a";
    return { format: fmt, ext };
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractYouTubeStream(
  url: string
): Promise<YouTubeStreamInfo> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("URL do YouTube inválida");

  const data = await callInnertube(videoId);

  if (data.playabilityStatus?.status !== "OK") {
    const reason = data.playabilityStatus?.reason ?? "Vídeo indisponível";
    throw new Error(reason);
  }

  const selected = pickBestAudio(data.streamingData?.adaptiveFormats ?? []);
  if (!selected) throw new Error("Nenhum formato de áudio disponível");

  const details = data.videoDetails;
  const thumbs = details?.thumbnail?.thumbnails ?? [];
  const thumbnailUrl = thumbs[thumbs.length - 1]?.url ?? null;

  return {
    title: details?.title ?? "Título Desconhecido",
    artist: details?.author ?? "Artista Desconhecido",
    duration: parseInt(details?.lengthSeconds ?? "0", 10),
    thumbnailUrl,
    audioUrl: selected.format.url!,
    fileExtension: selected.ext,
    contentLength: selected.format.contentLength
      ? parseInt(selected.format.contentLength, 10)
      : 0,
  };
}

// ─── Minimal Innertube response types ────────────────────────────────────────

interface InnertubeResponse {
  playabilityStatus?: { status: string; reason?: string };
  streamingData?: { adaptiveFormats?: AdaptiveFormat[] };
  videoDetails?: {
    videoId: string;
    title?: string;
    author?: string;
    lengthSeconds?: string;
    thumbnail?: { thumbnails: { url: string; width: number; height: number }[] };
  };
}

interface AdaptiveFormat {
  itag: number;
  url?: string;
  signatureCipher?: string;
  mimeType?: string;
  bitrate?: number;
  contentLength?: string;
}
