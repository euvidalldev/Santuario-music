/**
 * Runs once on app startup when running inside a Capacitor native shell.
 * - Creates the "Sanctuary" music folder in the device's Documents directory.
 * - Hides the splash screen after the app is ready.
 */
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

const MUSIC_FOLDER = "Sanctuary";

async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Dynamic import so the web bundle doesn't fail if plugin is tree-shaken
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { SplashScreen } = await import("@capacitor/splash-screen");

    // Create the Sanctuary folder (no-op if it already exists)
    try {
      await Filesystem.mkdir({
        path: MUSIC_FOLDER,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch {
      // Folder already exists — ignore
    }

    // Also create a sub-folder for downloaded tracks
    try {
      await Filesystem.mkdir({
        path: `${MUSIC_FOLDER}/Downloads`,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch {
      // Already exists — ignore
    }

    // Hide the native splash screen
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (err) {
    console.error("[Sanctuary] Capacitor init error:", err);
  }
}

export function useCapacitorInit() {
  useEffect(() => {
    initCapacitor();
  }, []);
}
