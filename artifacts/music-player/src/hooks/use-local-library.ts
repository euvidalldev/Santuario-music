import { useState, useEffect, useCallback } from "react";
import {
  LocalTrack, LocalFolder,
  getTracks, getFolders, updateTrack, removeTrack,
  addFolder, renameFolder, removeFolder,
} from "@/lib/local-db";

// Global refresh signal so all hooks update together
let refreshCount = 0;
const refreshListeners = new Set<() => void>();
export function refreshLibrary() {
  refreshCount++;
  refreshListeners.forEach(l => l());
}

function useRefreshSignal() {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set(n => n + 1);
    refreshListeners.add(l);
    return () => { refreshListeners.delete(l); };
  }, []);
}

// ── Tracks ────────────────────────────────────────────────────────────────────

export function useLocalTracks(folderId?: string | null) {
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useRefreshSignal();

  useEffect(() => {
    setIsLoading(true);
    getTracks(folderId).then(t => { setTracks(t); setIsLoading(false); });
  }, [folderId, refreshCount]);

  return { tracks, isLoading };
}

export function useLocalStats() {
  const { tracks } = useLocalTracks();
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  useRefreshSignal();
  useEffect(() => { getFolders().then(setFolders); }, [refreshCount]);
  return {
    totalTracks:  tracks.length,
    totalSize:    tracks.reduce((s, t) => s + t.fileSize, 0),
    totalFolders: folders.length,
  };
}

// ── Folders ───────────────────────────────────────────────────────────────────

export function useLocalFolders() {
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useRefreshSignal();

  useEffect(() => {
    setIsLoading(true);
    getFolders().then(f => { setFolders(f); setIsLoading(false); });
  }, [refreshCount]);

  const createFolder = useCallback(async (name: string) => {
    await addFolder(name);
    refreshLibrary();
  }, []);

  return { folders, isLoading, createFolder };
}

// ── Track actions ─────────────────────────────────────────────────────────────

export function useDeleteTrack() {
  return useCallback(async (id: string) => {
    await removeTrack(id);
    refreshLibrary();
  }, []);
}

export function useUpdateTrack() {
  return useCallback(async (id: string, updates: Partial<Pick<LocalTrack, "title" | "artist" | "folderId">>) => {
    await updateTrack(id, updates);
    refreshLibrary();
  }, []);
}

// ── Folder actions ────────────────────────────────────────────────────────────

export function useCreateFolder() {
  return useCallback(async (name: string) => {
    await addFolder(name);
    refreshLibrary();
  }, []);
}

export function useDeleteFolder() {
  return useCallback(async (id: string) => {
    await removeFolder(id);
    refreshLibrary();
  }, []);
}

export function useRenameFolder() {
  return useCallback(async (id: string, name: string) => {
    await renameFolder(id, name);
    refreshLibrary();
  }, []);
}
