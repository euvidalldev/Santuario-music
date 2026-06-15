import { useState, useCallback } from "react";

export type DownloadQuality = "64K" | "128K" | "192K" | "256K";

export interface AppSettings {
  downloadQuality: DownloadQuality;
}

const STORAGE_KEY = "sanctuary_settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        downloadQuality: parsed.downloadQuality ?? "128K",
      };
    }
  } catch {}
  return { downloadQuality: "128K" };
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);

  const setSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, setSettings };
}
