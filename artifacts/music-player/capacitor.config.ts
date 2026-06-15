import type { CapacitorConfig } from "@capacitor/cli";

// When building for production (APK/IPA), set VITE_API_URL to your deployed backend URL.
// Example: https://your-replit-app.replit.app
const serverUrl = process.env.VITE_API_URL;

const config: CapacitorConfig = {
  appId: "com.sanctuary.musicplayer",
  appName: "Sanctuary",
  webDir: "dist/public",

  // When running `npx cap run android` or `npx cap run ios` during development,
  // point to the live dev server so hot-reload works.
  // Remove / comment out the `server` block when building the production APK/IPA.
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: true,
        },
      }
    : {}),

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#1a0f00",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "Dark",
      backgroundColor: "#1a0f00",
    },
    Filesystem: {
      // no extra config needed — uses Directory.Documents by default
    },
  },

  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },

  ios: {
    contentInset: "always",
    scrollEnabled: true,
  },
};

export default config;
