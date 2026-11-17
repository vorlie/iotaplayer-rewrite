# Release Verification Checklist

Run through every item before publishing a new version of **IotaPlayer** (`pl.vorlie.iotaplayer`).

## 1. Identity & Metadata
- [ ] `package.json` version matches `CHANGELOG.md` and release tag `v<version>`.
- [ ] `productName` is `IotaPlayer`, publisher is `vorlie`, website is `https://vorlie.pl/projects/iotaplayer`.
- [ ] Identifiers remain unchanged: `pl.vorlie.iotaplayer`.

## 2. Build, Lint & Automated Tests
- [ ] `npx tsc -p tsconfig.app.json` passes with 0 errors.
- [ ] `npm run build` (`build:electron` + `build:renderer`) succeeds cleanly.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `node --test tests/*.test.mjs` passes all tests (lyrics, shuffle, volume, scanner, settings, media controls).

## 3. Security & Privacy
- [ ] `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true` verified in `electron/main.ts`.
- [ ] Production CSP header active when `app.isPackaged` is `true`; DevTools does not open in production.
- [ ] `will-navigate` and `setWindowOpenHandler` restrict external URLs to `http:` / `https:`.
- [ ] No hardcoded developer paths or signing credentials in source or `asar`.

## 4. Packaging & Assets
- [ ] `assets/icons/win/icon.ico`, `assets/icons/mac/icon.icns`, `assets/icons/linux/*`, and `public/favicon.svg` are up to date.
- [ ] Windows `npm run package` / `npm run make` produces `IotaPlayer.exe` and `IotaPlayer-<version>-win32-x64-setup.exe` with the IotaPlayer icon.
- [ ] macOS `.dmg` and Linux `AppImage` / `.deb` built on respective native/CI environments (or marked as pending CI if built from Windows).
- [ ] `SHA256SUMS.txt` generated for all uploaded artifacts.

## 5. Runtime & Upgrade Verification
- [ ] Launching a second instance focuses the existing window instead of opening a duplicate.
- [ ] Closing the app terminates `mpv` cleanly with no orphaned `mpv.exe` / `mpv` process.
- [ ] Upgrading over an existing `userData` directory preserves `library.db`, `app-settings.json`, playlists, favorites, and resume positions.
- [ ] Uninstalling does not delete the user's music folder or `userData`.
