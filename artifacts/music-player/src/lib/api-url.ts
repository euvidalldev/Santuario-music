/**
 * Returns the base API URL.
 *
 * - In the browser (Replit / web): uses relative "/api" — the proxy handles routing.
 * - In Capacitor (APK / IPA): uses the VITE_API_URL env variable that must point
 *   to your deployed backend, e.g. "https://your-app.replit.app".
 *
 * The Orval-generated hooks already use "/api/*" as their base paths.
 * To override, set the `axios` base URL at startup (done in main.tsx via initApiUrl).
 */

import { Capacitor } from "@capacitor/core";

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl;
  if (Capacitor.isNativePlatform()) {
    console.warn(
      "[Sanctuary] VITE_API_URL is not set — API calls may fail on device. " +
      "Rebuild with VITE_API_URL=https://your-app.replit.app pnpm build:cap"
    );
  }
  return "";
}
