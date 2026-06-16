/**
 * Handles the full download flow:
 * 1. Fetch track info from /api/stream/info
 * 2. Stream audio from /api/stream/audio with progress tracking
 * 3. Save to device filesystem via local-db
 * 4. Register track in local library
 */
import { useState, useCallback } from "react";
import { saveAudioFile, addTrack, newId, LocalTrack } from "@/lib/local-db";
import { refreshLibrary } from "./use-local-library";
import { getApiBaseUrl } from "@/lib/api-url";
import { loadSettings } from "./use-settings";

export type DownloadStatus = "idle" | "fetching_info" | "downloading" | "saving" | "done" | "error";

export interface DownloadItem {
  id: string;
  youtubeUrl: string;
  title: string;
  status: DownloadStatus;
  progress: number;   // 0-100
  error?: string;
}

const BASE = () => getApiBaseUrl();

function cookiesHeader(): Record<string, string> {
  try {
    const cookies = loadSettings().youtubeCookies;
    return cookies ? { "x-youtube-cookies": cookies } : {};
  } catch { return {}; }
}

export function useLocalDownload() {
  const [queue, setQueue] = useState<DownloadItem[]>([]);

  const updateItem = (id: string, updates: Partial<DownloadItem>) =>
    setQueue(q => q.map(item => item.id === id ? { ...item, ...updates } : item));

  const download = useCallback(async (youtubeUrl: string, quality: string, folderId: string | null) => {
    const itemId = crypto.randomUUID();
    const newItem: DownloadItem = { id: itemId, youtubeUrl, title: youtubeUrl, status: "fetching_info", progress: 0 };
    setQueue(q => [...q, newItem]);

    try {
      // Step 1: Fetch metadata
      const infoRes = await fetch(`${BASE()}/api/stream/info?url=${encodeURIComponent(youtubeUrl)}`, { headers: cookiesHeader() });
      if (!infoRes.ok) {
        const errBody = await infoRes.text().catch(() => "");
        throw new Error(errBody ? `Info failed: ${errBody.slice(0, 300)}` : `Info failed (${infoRes.status})`);
      }
      const info = await infoRes.json() as { title: string; artist: string; duration: number; thumbnailUrl: string | null };
      updateItem(itemId, { title: info.title, status: "downloading" });

      // Step 2: Stream audio with progress
      const audioUrl = `${BASE()}/api/stream/audio?url=${encodeURIComponent(youtubeUrl)}&quality=${quality}`;
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
        if (total > 0) {
          updateItem(itemId, { progress: Math.round((received / total) * 90) });
        }
      }

      const blob = new Blob(chunks as BlobPart[], { type: "audio/mp4" });
      const fileSize = blob.size;

      // Step 3: Save to device
      updateItem(itemId, { status: "saving", progress: 92 });
      const safeFilename = `${info.title.replace(/[^\w\s-]/g, "_").slice(0, 100)}.m4a`;
      const trackId = newId();
      const { localPath } = await saveAudioFile(trackId, blob, safeFilename);
      updateItem(itemId, { progress: 98 });

      // Step 4: Register in library
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

      updateItem(itemId, { status: "done", progress: 100 });
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
