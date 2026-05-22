# Capacitor Android Build — Glassbird

This project is configured for Capacitor. Android Studio cannot run inside Lovable's sandbox — you must do the native build on your **local machine**.

## Prerequisites (local machine)

- Node 20+ and Bun (or npm)
- Java JDK 21
- Android Studio (latest) with Android SDK + Platform-Tools
- Set env: `ANDROID_HOME=~/Android/Sdk` (or wherever your SDK lives)

## One-time setup

```bash
# 1. Clone / pull the project, then install deps
bun install

# 2. Build the web app (static client bundle)
bun run build

# 3. Add the native Android platform (creates ./android/)
bunx cap add android

# 4. Sync web assets + plugins into the native project
bunx cap sync android
```

## Every time you change web code

```bash
bun run build
bunx cap sync android
```

## Open in Android Studio

```bash
bunx cap open android
```

In Android Studio:
1. Wait for Gradle sync to finish.
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)** for a debug APK.
3. For a release APK: **Build → Generate Signed Bundle / APK**, create a keystore, choose APK, select `release`.

The APK lands in `android/app/build/outputs/apk/`.

## App identity

Edit `capacitor.config.ts`:
- `appId` — `app.lovable.glassbird` (reverse-DNS, must be unique on Play Store)
- `appName` — `Glassbird`
- `webDir` — `dist/client` (TanStack Start's static client bundle)

After changing `appId`, delete `./android/` and re-run `cap add android`.

## Icons & splash

Replace `public/icons/icon-512.png` with your final art, then:

```bash
bun add -d @capacitor/assets
bunx capacitor-assets generate --android
```

This regenerates every density of launcher icons and splash images.

## Notes

- The game is fully offline-capable (Canvas + localStorage), so no backend is needed inside the APK.
- The service worker registered for the PWA is harmless inside Capacitor's WebView but unnecessary — Capacitor already serves assets from the bundle.
- For Play Store submission, target SDK 34+ and provide a signed **AAB** (`Build → Generate Signed Bundle`) rather than an APK.
