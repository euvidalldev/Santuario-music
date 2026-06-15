# Building Sanctuary for Android (APK) and iOS (IPA)

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| pnpm | ≥ 9 | `npm i -g pnpm` |
| Android Studio | latest | https://developer.android.com/studio |
| Xcode | ≥ 15 | Mac App Store (iOS only) |
| JDK | 17 | bundled with Android Studio |

## 1. Deploy the backend first

The mobile app needs to talk to the API server. Deploy the Replit project (hit **Deploy** in Replit), then copy the production URL — it looks like:

```
https://your-project-name.replit.app
```

## 2. Clone / download this project on your local machine

```bash
git clone <your-repo-url>
cd <repo-root>
pnpm install
```

## 3. Build the web assets for Capacitor

```bash
cd artifacts/music-player

# Replace the URL below with your deployed backend
VITE_API_URL=https://your-project-name.replit.app pnpm build:cap
```

This produces `artifacts/music-player/dist/public/` — a self-contained web bundle
using relative asset paths (compatible with the native WebView).

## 4. Add native platforms (first time only)

```bash
# still inside artifacts/music-player/
npx cap add android
npx cap add ios      # Mac only
```

## 5. Sync web assets into native projects

```bash
npx cap sync
```

Run this every time you rebuild with `pnpm build:cap`.

---

## Building the APK (Android)

```bash
npx cap open android
```

Android Studio opens. Then:

1. **Build → Generate Signed Bundle / APK**
2. Choose **APK**
3. Create or select a keystore (keep it safe!)
4. Select **release** build variant
5. Click **Finish** — the APK is saved under `android/app/release/`

### Debug APK (no signing needed)

```bash
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Building the IPA (iOS — Mac only)

```bash
npx cap open ios
```

Xcode opens. Then:

1. Select your **Team** in Signing & Capabilities
2. Set **Bundle Identifier** to `com.sanctuary.musicplayer`
3. **Product → Archive**
4. In the Organizer, click **Distribute App**
5. Choose **Ad Hoc** (direct install) or **App Store Connect**

---

## Music folder on the device

When the app launches for the first time it automatically creates:

```
Documents/
└── Sanctuary/
    └── Downloads/
```

This is done via `@capacitor/filesystem` in `src/hooks/use-capacitor.ts`.
On Android the folder appears in **Files → Internal Storage → Documents → Sanctuary**.
On iOS it appears in the **Files** app under **On My iPhone → Sanctuary**.

---

## Permissions configured automatically

| Permission | Android | iOS |
|-----------|---------|-----|
| Read external storage | ✅ via Capacitor | n/a |
| Write external storage | ✅ via Capacitor | n/a |
| Network access | ✅ | ✅ |
| Local file access | ✅ | ✅ (Files app) |

---

## Updating the app

1. Make changes in Replit
2. Re-deploy the backend
3. Rebuild: `VITE_API_URL=https://your-project.replit.app pnpm build:cap`
4. Sync: `npx cap sync`
5. Rebuild the APK / IPA in Android Studio / Xcode
