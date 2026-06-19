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

const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player";

const CLIENT_CONTEXT = {
  client: {
    clientName: "ANDROID",
    clientVersion: "19.09.37",
    androidSdkVersion: 30,
    userAgent:
      "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
    hl: "en",
    gl: "US",
    timeZone: "UTC",
    utcOffsetMinutes: 0,
  },
};

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
  "X-YouTube-Client-Name": "3",
  "X-YouTube-Client-Version": "19.09.37",
  "Accept-Language": "en-US,en;q=0.9",
};

async function callInnertube(videoId: string): Promise<InnertubeResponse> {
  const payload = { context: CLIENT_CONTEXT, videoId };

  if (Capacitor.isNativePlatform()) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.post({
      url: INNERTUBE_URL,
      headers: HEADERS,
      data: payload,
    });
    return res.data as InnertubeResponse;
  }

  const res = await fetch(INNERTUBE_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Innertube HTTP ${res.status}`);
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
