import { useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { saveAudioFile, addTrack, newId, LocalTrack } from "@/lib/local-db";
import { refreshLibrary } from "./use-local-library";
import { getApiBaseUrl } from "@/lib/api-url";
import { loadSettings } from "./use-settings";
import { getTrackInfo, downloadAudio } from "@/lib/inner-tube";

export type DownloadStatus = "idle" | "fetching_info" | "downloading" | "saving" | "done" | "error";

export interface DownloadItem {
  id: string;
  youtubeUrl: string;
  title: string;
  status: DownloadStatus;
  progress: number;
  error?: string;
}

const BASE = () => getApiBaseUrl();

function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("list");
    u.searchParams.delete("start_radio");
    u.searchParams.delete("pp");
    return u.toString();
  } catch { return url; }
}

function cookiesHeader(): Record<string, string> {
  try {
    const cookies = loadSettings().youtubeCookies;
    if (!cookies) return {};
    const lines = cookies.split("\n").filter(l =>
      l.includes("youtube.com") || l.includes("ytimg.com") || l.includes("googlevideo.com")
    );
    if (lines.length === 0) return {};
    const encoded = btoa(lines.join("\n"));
    return { "x-youtube-cookies": encoded };
  } catch { return {}; }
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    const v = u.searchParams.get("v");
    if (v) return v;
    if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
    return null;
  } catch { return null; }
}

/** Download using on-device InnerTube API (phone IP, no CORS issues) */
async function mobileDownload(youtubeUrl: string, folderId: string | null, update: (updates: Partial<DownloadItem>) => void): Promise<void> {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error("Invalid YouTube URL");

  update({ status: "fetching_info" });
  const { info, formats } = await getTrackInfo(videoId);
  update({ title: info.title });

  if (formats.length === 0) throw new Error("No downloadable audio formats found");

  const format = formats[0];
  const ext = format.mimeType.includes("mp4") ? "m4a" : "webm";

  update({ status: "downloading", progress: 5 });
  const audioBuffer = await downloadAudio(format.url);
  const blob = new Blob([audioBuffer], { type: format.mimeType });

  update({ status: "saving", progress: 90 });
  const safeFilename = `${info.title.replace(/[^\w\s-]/g, "_").slice(0, 100)}.${ext}`;
  const trackId = newId();
  const { localPath } = await saveAudioFile(trackId, blob, safeFilename);

  const track: LocalTrack = {
    id: trackId,
    title: info.title,
    artist: info.artist,
    duration: info.duration,
    fileSize: audioBuffer.byteLength,
    localPath,
    thumbnailUrl: info.thumbnailUrl,
    youtubeUrl,
    folderId,
    downloadedAt: new Date().toISOString(),
  };
  await addTrack(track);
  refreshLibrary();
  update({ status: "done", progress: 100 });
}

/** Download using server-side yt-dlp proxy (for web / fallback) */
async function serverDownload(youtubeUrl: string, quality: string, folderId: string | null, update: (updates: Partial<DownloadItem>) => void): Promise<void> {
  const cleanedUrl = cleanUrl(youtubeUrl);
  const infoRes = await fetch(`${BASE()}/api/stream/info?url=${encodeURIComponent(cleanedUrl)}`, { headers: cookiesHeader() });
  if (!infoRes.ok) {
    const errBody = await infoRes.text().catch(() => "");
    throw new Error(errBody ? `Info failed: ${errBody.slice(0, 300)}` : `Info failed (${infoRes.status})`);
  }
  const info = await infoRes.json() as { title: string; artist: string; duration: number; thumbnailUrl: string | null };
  update({ title: info.title, status: "downloading" });

  const audioUrl = `${BASE()}/api/stream/audio?url=${encodeURIComponent(cleanedUrl)}&quality=${quality}`;
  const audioRes = await fetch(audioUrl, { headers: cookiesHeader() });
  if (!audioRes.ok) throw new Error(`Download failed: ${audioRes.statusText}`);

  const contentLength = audioRes.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const reader = audioRes.body!.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) update({ progress: Math.round((received / total) * 90) });
  }

  const blob = new Blob(chunks as BlobPart[], { type: "audio/mp4" });
  const fileSize = blob.size;

  update({ status: "saving", progress: 92 });
  const safeFilename = `${info.title.replace(/[^\w\s-]/g, "_").slice(0, 100)}.m4a`;
  const trackId = newId();
  const { localPath } = await saveAudioFile(trackId, blob, safeFilename);
  update({ progress: 98 });

  const track: LocalTrack = {
    id: trackId,
    title: info.title,
    artist: info.artist,
    duration: info.duration,
    fileSize,
    localPath,
    thumbnailUrl: info.thumbnailUrl,
    youtubeUrl,
    folderId,
    downloadedAt: new Date().toISOString(),
  };
  await addTrack(track);
  refreshLibrary();
  update({ status: "done", progress: 100 });
}

export function useLocalDownload() {
  const [queue, setQueue] = useState<DownloadItem[]>([]);

  const updateItem = (id: string, updates: Partial<DownloadItem>) =>
    setQueue(q => q.map(item => item.id === id ? { ...item, ...updates } : item));

  const download = useCallback(async (youtubeUrl: string, quality: string, folderId: string | null) => {
    const itemId = crypto.randomUUID();
    const newItem: DownloadItem = { id: itemId, youtubeUrl, title: youtubeUrl, status: "fetching_info", progress: 0 };
    setQueue(q => [...q, newItem]);

    const upd = (u: Partial<DownloadItem>) => updateItem(itemId, u);

    try {
      if (Capacitor.isNativePlatform()) {
        await mobileDownload(youtubeUrl, folderId, upd);
      } else {
        await serverDownload(youtubeUrl, quality, folderId, upd);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateItem(itemId, { status: "error", error: msg.slice(0, 200) });
    }
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(q => q.filter(item => item.id !== id));
  }, []);

  return { queue, download, removeFromQueue };
}
