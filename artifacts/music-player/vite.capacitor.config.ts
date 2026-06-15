/**
 * Vite config used exclusively for Capacitor builds.
 * Run: pnpm build:cap
 *
 * Differences from the main config:
 *   - base is "./" so assets resolve correctly inside the native WebView
 *   - No PORT / BASE_PATH requirements (not a dev server)
 *   - VITE_API_URL must be set to your deployed backend, e.g.
 *       VITE_API_URL=https://your-app.replit.app pnpm build:cap
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  define: {
    // Makes import.meta.env.VITE_API_URL available at runtime
    "import.meta.env.VITE_API_URL": JSON.stringify(process.env.VITE_API_URL ?? ""),
  },
});
