import { useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { extractYouTubeStream, extractVideoId } from "@/lib/youtube-extractor";
import { saveAudioFile, addTrack, newId, LocalTrack } from "@/lib/local-db";
import { refreshLibrary } from "./use-local-library";
import { getApiBaseUrl } from "@/lib/api-url";
import { t } from "@/lib/pt-br";

export type DownloadStatus = "idle" | "extracting" | "downloading" | "saving" | "done" | "error";

export interface DownloadItem {
  id: string;
  youtubeUrl: string;
  title: string;
  status: DownloadStatus;
  progress: number;
  source: "device" | "server" | "unknown";
  error?: string;
}

const BASE = () => getApiBaseUrl();

async function fetchWithRetry(url: string, retries = 3, delayMs = 3000): Promise<Response> {
  for (let i = 0; i < retries - 1; i++) {
    const res = await fetch(url);
    if (res.ok) return res;
    await new Promise(r => setTimeout(r, delayMs * (i + 1)));
  }
  return fetch(url);
}

async function fetchWithProgress(
  url: string,
  knownLength: number,
  onProgress: (pct: number) => void
): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentLength = knownLength || parseInt(res.headers.get("Content-Length") ?? "0", 10);
  const chunks: Uint8Array[] = [];

  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength > 0) {
        onProgress(Math.round((received / contentLength) * 100));
      }
    }
  } else {
    const arrayBuffer = await res.arrayBuffer();
    chunks.push(new Uint8Array(arrayBuffer));
    if (contentLength > 0) {
      onProgress(100);
    }
  }

  return new Blob(chunks as BlobPart[], { type: "audio/mp4" });
}

export function useLocalDownload() {
  const [queue, setQueue] = useState<DownloadItem[]>([]);

  const update = (id: string, patch: Partial<DownloadItem>) =>
    setQueue(q => q.map(item => (item.id === id ? { ...item, ...patch } : item)));

  const download = useCallback(async (youtubeUrl: string, quality: string, folderId: string | null) => {
    const itemId = crypto.randomUUID();
    const init: DownloadItem = {
      id: itemId, youtubeUrl, title: youtubeUrl,
      status: "extracting", progress: 0, source: "unknown",
    };
    setQueue(q => [...q, init]);

    try {
      let audioUrl: string;
      let title = "Desconhecido";
      let artist = "Artista Desconhecido";
      let duration = 0;
      let thumbnailUrl: string | null = null;
      let fileExtension = "m4a";
      let contentLength = 0;
      let source: DownloadItem["source"] = "device";

      if (Capacitor.isNativePlatform()) {
        try {
          const info = await extractYouTubeStream(youtubeUrl);
          audioUrl = info.audioUrl;
          title = info.title;
          artist = info.artist;
          duration = info.duration;
          thumbnailUrl = info.thumbnailUrl;
          fileExtension = info.fileExtension;
          contentLength = info.contentLength;
          source = "device";
        } catch {
          let infoRes = await fetchWithRetry(`${BASE()}/api/stream/info?url=${encodeURIComponent(youtubeUrl)}`);
          if (!infoRes.ok) {
            if (infoRes.status === 0 || infoRes.status >= 500) {
              await new Promise(r => setTimeout(r, 5000));
              infoRes = await fetchWithRetry(`${BASE()}/api/stream/info?url=${encodeURIComponent(youtubeUrl)}`);
            }
            if (!infoRes.ok) throw new Error(`Falha ao buscar info: ${infoRes.status} ${infoRes.statusText}`);
          }
          const info: { title: string; artist: string; duration: number; thumbnailUrl: string | null } = await infoRes.json();
          title = info.title;
          artist = info.artist;
          duration = info.duration;
          thumbnailUrl = info.thumbnailUrl;
          audioUrl = `${BASE()}/api/stream/audio?url=${encodeURIComponent(youtubeUrl)}&quality=${quality}`;
          source = "server";
        }
      } else {
        try {
          const info = await extractYouTubeStream(youtubeUrl);
          audioUrl = info.audioUrl;
          title = info.title;
          artist = info.artist;
          duration = info.duration;
          thumbnailUrl = info.thumbnailUrl;
          fileExtension = info.fileExtension;
          contentLength = info.contentLength;
          source = "device";
        } catch {
          let infoRes = await fetchWithRetry(`${BASE()}/api/stream/info?url=${encodeURIComponent(youtubeUrl)}`);
          if (!infoRes.ok) {
            if (infoRes.status === 0 || infoRes.status >= 500) {
              await new Promise(r => setTimeout(r, 5000));
              infoRes = await fetchWithRetry(`${BASE()}/api/stream/info?url=${encodeURIComponent(youtubeUrl)}`);
            }
            if (!infoRes.ok) throw new Error(`Servidor falhou: ${infoRes.status} ${infoRes.statusText}`);
          }
          const ct = infoRes.headers.get("content-type") || "";
          if (!ct.includes("json")) {
            throw new Error("Servidor retornou HTML (possivelmente dormindo)");
          }
          const info: { title: string; artist: string; duration: number; thumbnailUrl: string | null } = await infoRes.json();
          title = info.title;
          artist = info.artist;
          duration = info.duration;
          thumbnailUrl = info.thumbnailUrl;
          audioUrl = `${BASE()}/api/stream/audio?url=${encodeURIComponent(youtubeUrl)}&quality=${quality}`;
          source = "server";
        }
      }

      update(itemId, { title, status: "downloading", source, progress: 2 });

      const blob = await fetchWithProgress(
        audioUrl,
        contentLength,
        (pct) => update(itemId, { progress: 2 + Math.round(pct * 0.88) })
      );
      const fileSize = blob.size;

      update(itemId, { status: "saving", progress: 92 });
      const videoId = extractVideoId(youtubeUrl) ?? crypto.randomUUID().slice(0, 8);
      const safeTitle = title.replace(/[^\w\s\-()]/g, "_").slice(0, 80);
      const filename = `${safeTitle}_${videoId}.${fileExtension}`;
      const trackId = newId();

      const { localPath } = await saveAudioFile(trackId, blob, filename);
      update(itemId, { progress: 98 });

      const track: LocalTrack = {
        id: trackId, title, artist, duration, fileSize,
        localPath, thumbnailUrl, youtubeUrl, folderId,
        downloadedAt: new Date().toISOString(),
      };
      await addTrack(track);
      refreshLibrary();

      update(itemId, { status: "done", progress: 100, title });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      update(itemId, { status: "error", error: msg.slice(0, 250) });
    }
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(q => q.filter(item => item.id !== id));
  }, []);

  return { queue, download, removeFromQueue };
}
