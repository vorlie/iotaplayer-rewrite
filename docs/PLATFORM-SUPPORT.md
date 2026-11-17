# Platform Support & Known Limitations

## Supported Platforms

| Platform | Architecture | Distribution Format | Status |
| :--- | :--- | :--- | :--- |
| **Windows 10 / 11** | `x64` | Squirrel Installer (`.exe`), Portable `.zip` | **Verified locally** (built & packaged via Electron Forge) |
| **macOS 12+** | `arm64`, `x64` | `.dmg`, `.zip` | **Configured** (`electron-builder.json` + `forge.config.js`); requires macOS host/CI to build & sign |
| **Linux** | `x64` | `AppImage`, `.deb` | **Configured** (`electron-builder.json`); requires Linux host/CI to build & verify |

> **Native dependency note (`better-sqlite3`)**: Because `better-sqlite3` contains a native C++ Node addon, cross-compiling native binaries from Windows to macOS/Linux is not supported out of the box. macOS and Linux release artifacts should be built on their respective OS runners (e.g. GitHub Actions `macos-latest` and `ubuntu-latest`).

---

## Playback Backend Requirements

- **MPV (Primary)**: Expects `mpv` to be installed and available on the system `PATH` (e.g. `winget install mpv`, `brew install mpv`, `apt install mpv`).
- **Browser / Web Audio (Fallback)**: Automatically used if `mpv` is unavailable or selected in **Settings → Playback**. Supports browser-compatible codecs (MP3, AAC, OGG, WAV, FLAC in Chromium), 10-band EQ, and real-time spectrum visualization.

---

## Development Mode Icon Behavior (Windows)

When running unpackaged (`npm run dev` or `npm start`), Windows launches `node_modules/electron/dist/electron.exe`. Even with `app.setAppUserModelId('pl.vorlie.iotaplayer')` and `BrowserWindow({ icon })` configured:
- Task Manager and initial taskbar grouping may temporarily show `electron.exe`'s embedded Electron icon, or Windows Explorer's icon cache may retain an older icon.
- Packaged production builds (`npm run package` / `npm run make`) embed `assets/icons/win/icon.ico` directly into `IotaPlayer.exe` and `IotaPlayer-<version>-win32-x64-setup.exe`.

---

## Known Limitations

1. **Code Signing & Notarization**: Release binaries are unsigned until Windows Authenticode (`.pfx`) and Apple Developer ID / notarization credentials are configured in CI. Windows SmartScreen and macOS Gatekeeper will warn on unsigned downloads.
2. **No Background Auto-Updater**: Updates are distributed manually via `https://vorlie.pl/projects/iotaplayer/download` until code signing is active.
3. **10-Band EQ & Spectrum Visualizer**: The real-time canvas spectrum visualizer is active on the Browser audio backend; MPV uses `lavfi` equalizer filters without spectrum data streaming.
