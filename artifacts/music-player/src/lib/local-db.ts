/**
 * Device-side storage layer.
 *
 * Native (Capacitor):
 *   - Audio files  → Documents/Sanctuary/Downloads/<filename>
 *   - Library JSON → Documents/Sanctuary/library.json
 *
 * Web (browser):
 *   - Audio blobs  → in-memory blob URL map
 *   - Library JSON → localStorage
 */
import { Capacitor } from "@capacitor/core";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;        // seconds
  fileSize: number;        // bytes
  localPath: string;       // "Sanctuary/Downloads/xyz.m4a"
  thumbnailUrl: string | null;
  youtubeUrl: string | null;
  folderId: string | null;
  downloadedAt: string;    // ISO
}

export interface LocalFolder {
  id: string;
  name: string;
  createdAt: string;
}

interface LibraryData {
  tracks: LocalTrack[];
  folders: LocalFolder[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOWNLOADS_FOLDER = "Sanctuary/Downloads";
const LIBRARY_FILE     = "Sanctuary/library.json";
const WEB_STORAGE_KEY  = "sanctuary_library_v2";

// ─── IndexedDB for web audio persistence ────────────────────────────────────

const DB_NAME = "SanctuaryAudio";
const DB_VERSION = 1;
const STORE_NAME = "audio";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIndexedDB(trackId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ id: trackId, blob });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function loadFromIndexedDB(trackId: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(trackId);
    req.onsuccess = () => { db.close(); resolve(req.result?.blob ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function removeFromIndexedDB(trackId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(trackId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ─── Blob URL cache for active session ──────────────────────────────────────

const blobUrls = new Map<string, string>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId(): string {
  return crypto.randomUUID();
}

async function getFilesystem() {
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  return { Filesystem, Directory, Encoding };
}

// ─── Library persistence ──────────────────────────────────────────────────────

async function readLibrary(): Promise<LibraryData> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await getFilesystem();
    try {
      await Filesystem.mkdir({ path: "Sanctuary", directory: Directory.Documents, recursive: true });
      const { data } = await Filesystem.readFile({ path: LIBRARY_FILE, directory: Directory.Documents, encoding: Encoding.UTF8 });
      return JSON.parse(data as string) as LibraryData;
    } catch {
      return { tracks: [], folders: [] };
    }
  }
  try {
    const raw = localStorage.getItem(WEB_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LibraryData;
  } catch {}
  return { tracks: [], folders: [] };
}

async function writeLibrary(data: LibraryData): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await getFilesystem();
    await Filesystem.mkdir({ path: "Sanctuary", directory: Directory.Documents, recursive: true });
    await Filesystem.writeFile({
      path: LIBRARY_FILE,
      data: JSON.stringify(data),
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
  } else {
    const json = JSON.stringify(data);
    const size = new Blob([json]).size;
    try {
      localStorage.setItem(WEB_STORAGE_KEY, json);
    } catch {
      console.error("local-db: localStorage write failed, library may be incomplete.", { size });
      throw new Error("localStorage write failed");
    }
  }
}

// ─── Tracks ───────────────────────────────────────────────────────────────────

export async function getTracks(folderId?: string | null): Promise<LocalTrack[]> {
  const lib = await readLibrary();
  if (folderId === undefined) return lib.tracks;
  if (folderId === null) return lib.tracks.filter(t => t.folderId === null);
  return lib.tracks.filter(t => t.folderId === folderId);
}

export async function addTrack(track: LocalTrack): Promise<void> {
  const lib = await readLibrary();
  lib.tracks.push(track);
  await writeLibrary(lib);
}

export async function updateTrack(id: string, updates: Partial<Pick<LocalTrack, "title" | "artist" | "folderId">>): Promise<void> {
  const lib = await readLibrary();
  const idx = lib.tracks.findIndex(t => t.id === id);
  if (idx >= 0) {
    lib.tracks[idx] = { ...lib.tracks[idx], ...updates };
    await writeLibrary(lib);
  }
}

export async function removeTrack(id: string): Promise<void> {
  const lib = await readLibrary();
  const track = lib.tracks.find(t => t.id === id);
  if (track) {
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await getFilesystem();
      try { await Filesystem.deleteFile({ path: track.localPath, directory: Directory.Documents }); } catch {}
    } else {
      const url = blobUrls.get(id);
      if (url) { URL.revokeObjectURL(url); blobUrls.delete(id); }
      await removeFromIndexedDB(id);
    }
  }
  lib.tracks = lib.tracks.filter(t => t.id !== id);
  await writeLibrary(lib);
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function getFolders(): Promise<LocalFolder[]> {
  const lib = await readLibrary();
  return lib.folders;
}

export async function addFolder(name: string): Promise<LocalFolder> {
  const lib = await readLibrary();
  const folder: LocalFolder = { id: newId(), name, createdAt: new Date().toISOString() };
  lib.folders.push(folder);
  await writeLibrary(lib);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const lib = await readLibrary();
  const idx = lib.folders.findIndex(f => f.id === id);
  if (idx >= 0) { lib.folders[idx].name = name; await writeLibrary(lib); }
}

export async function removeFolder(id: string): Promise<void> {
  const lib = await readLibrary();
  lib.folders = lib.folders.filter(f => f.id !== id);
  lib.tracks  = lib.tracks.map(t => t.folderId === id ? { ...t, folderId: null } : t);
  await writeLibrary(lib);
}

// ─── Audio file save & playback ───────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Save audio blob to device and return the playable src URL */
export async function saveAudioFile(trackId: string, blob: Blob, filename: string): Promise<{ localPath: string; audioSrc: string }> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await getFilesystem();
    await Filesystem.mkdir({ path: DOWNLOADS_FOLDER, directory: Directory.Documents, recursive: true });
    const base64   = await blobToBase64(blob);
    const localPath = `${DOWNLOADS_FOLDER}/${filename}`;
    await Filesystem.writeFile({ path: localPath, data: base64, directory: Directory.Documents });
    const { uri } = await Filesystem.getUri({ path: localPath, directory: Directory.Documents });
    const audioSrc = Capacitor.convertFileSrc(uri);
    return { localPath, audioSrc };
  }
  // Web: IndexedDB + blob URL
  await saveToIndexedDB(trackId, blob);
  const audioSrc = URL.createObjectURL(blob);
  blobUrls.set(trackId, audioSrc);
  return { localPath: filename, audioSrc };
}

/** Get a playable audio src for an already-saved track */
export async function getAudioSrc(track: LocalTrack): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await getFilesystem();
    try {
      const { uri } = await Filesystem.getUri({ path: track.localPath, directory: Directory.Documents });
      return Capacitor.convertFileSrc(uri);
    } catch { return ""; }
  }
  const cached = blobUrls.get(track.id);
  if (cached) return cached;
  // Try loading from IndexedDB on page refresh
  const blob = await loadFromIndexedDB(track.id);
  if (blob) {
    const url = URL.createObjectURL(blob);
    blobUrls.set(track.id, url);
    return url;
  }
  return "";
}

export { newId };
