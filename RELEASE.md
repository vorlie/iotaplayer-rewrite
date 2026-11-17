# IotaPlayer Release Procedure

This document describes how to prepare, build, verify, sign, checksum, and publish a public release of **IotaPlayer** (`pl.vorlie.iotaplayer`) for Windows, macOS, and Linux, as well as publish artifacts for `https://vorlie.pl/projects/iotaplayer/download`.

---

## 1. Release Identity & Artifact Naming

| Property | Value |
| :--- | :--- |
| Product Name | `IotaPlayer` |
| Publisher | `vorlie` (`https://vorlie.pl`) |
| Project Page | `https://vorlie.pl/projects/iotaplayer` |
| App Identifier | `pl.vorlie.iotaplayer` |
| Versioning | Semantic Versioning (`MAJOR.MINOR.PATCH`) |

### Standard Artifact Filenames

- **Windows (x64 Squirrel Installer)**: `IotaPlayer-<version>-win32-x64-setup.exe`
- **Windows (x64 Portable Zip)**: `IotaPlayer-win32-x64-<version>.zip`
- **macOS (Apple Silicon / Intel DMG)**: `IotaPlayer-<version>-mac-arm64.dmg`, `IotaPlayer-<version>-mac-x64.dmg`
- **Linux (AppImage & Debian)**: `IotaPlayer-<version>-linux-x64.AppImage`, `IotaPlayer-<version>-linux-x64.deb`
- **Checksums**: `SHA256SUMS.txt`

---

## 2. Prerequisites

### Common
- **Node.js** 22+ and **npm**
- Native addon toolchain for `better-sqlite3` (`electron-rebuild` / node-gyp) on target OS when building natively
- **uv** (optional, only if regenerating icons from `assets/icons/iotaplayer.svg`)

### Platform-Specific
- **Windows**: Windows 10/11 x64, Visual Studio C++ Build Tools (for native addons if rebuilding), optional Windows SDK `signtool.exe` for Authenticode signing.
- **macOS**: macOS host with Xcode Command Line Tools, Apple Developer ID Application certificate, and App Store Connect / `notarytool` credentials for notarization.
- **Linux**: Ubuntu/Debian x64 host (or CI runner) with `dpkg` / `fakeroot` / FUSE for `.deb` and `AppImage`.

---

## 3. Version Bump Procedure

1. Update `"version"` in `package.json` (e.g. `1.0.0` → `1.0.1` or `1.1.0`).
2. Update `CHANGELOG.md` with the new version, release date, and categorized changes.
3. Verify `npm run build`, `npm run lint`, and `node --test tests/*.test.mjs`.
4. Commit the version bump and tag the release:
   ```bash
   git tag -a v<version> -m "Release v<version>"
   ```

---

## 4. Automated Releases via GitHub Actions (Canonical)

The repository includes two GitHub Actions workflows:
- **`.github/workflows/ci.yml`** — runs typecheck, build, lint, and `node --test tests/*.test.mjs` on `ubuntu-latest`, `macos-latest`, and `windows-latest` for every push and PR to `main`.
- **`.github/workflows/release.yml`** — triggered automatically when a version tag matching `v*` (e.g. `v1.0.0`) is pushed (or manually via `workflow_dispatch`):
  1. Verifies that the tag version matches `package.json` and passes all checks.
  2. Builds **Windows x64** (`npm run make`), **macOS arm64 + x64** (`npm run dist:mac`), and **Linux x64** (`npm run dist:linux`) on their respective GitHub-hosted runners.
  3. Generates `SHA256SUMS.txt` and attaches all platform installers and checksums to the GitHub Release.

### Optional Signing Secrets
Unsigned builds work out of the box when no secrets are configured. To enable code signing and notarization in CI, add these repository secrets:
- **Windows Authenticode**: `WIN_CSC_LINK` (base64-encoded `.pfx`) and `WIN_CSC_KEY_PASSWORD`
- **macOS Signing & Notarization**: `CSC_LINK` (base64-encoded Developer ID `.p12`), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

---

## 5. Manual Build Commands

### Regenerate Icons (only if `assets/icons/iotaplayer.svg` changed)
```bash
uv run --with resvg-py --with pillow python scripts/generate-icons.py
```

### Windows (Electron Forge — Tested on Windows x64)
```bash
# Packaged unpacked app -> out/IotaPlayer-win32-x64/
npm run package

# Windows Squirrel installer + portable zip -> out/make/
npm run make
```

### macOS (Electron Builder — Run on macOS host/CI)
```bash
npm run dist:mac
# Outputs to out/dist/
```

### Linux (Electron Builder — Run on Linux host/CI)
```bash
npm run dist:linux
# Outputs to out/dist/
```

---

## 5. Signing & Notarization

> **Security**: Never commit `.pfx`, `.p12`, API keys, or Apple notarization passwords to the repository.

### Windows (Authenticode)
Sign both the packaged `IotaPlayer.exe` and `IotaPlayer-<version>-win32-x64-setup.exe` with `signtool.exe` or pass Squirrel `certificateFile` / `certificatePassword` via CI environment variables:
```powershell
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /f <cert.pfx> /p $env:WIN_CERT_PASSWORD out\make\squirrel.windows\x64\IotaPlayer-<version>-win32-x64-setup.exe
```

### macOS (Code Signing + Apple Notarization)
On a macOS runner with `CSC_LINK` and `CSC_KEY_PASSWORD` exported (`electron-builder` signs automatically), submit the `.dmg` for notarization:
```bash
xcrun notarytool submit out/dist/IotaPlayer-<version>-mac-arm64.dmg --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --wait
xcrun stapler staple out/dist/IotaPlayer-<version>-mac-arm64.dmg
```

---

## 6. Generating SHA-256 Checksums

Generate `SHA256SUMS.txt` before uploading to `https://vorlie.pl/projects/iotaplayer/download`:

```powershell
# PowerShell (Windows)
Get-FileHash out\make\squirrel.windows\x64\*.exe, out\make\zip\win32\x64\*.zip -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash.ToLower())  $(Split-Path $_.Path -Leaf)" } |
  Out-File -Encoding ascii SHA256SUMS.txt
```

```bash
# POSIX (macOS / Linux)
sha256sum out/dist/*.dmg out/dist/*.AppImage out/dist/*.deb > SHA256SUMS.txt
```

---

## 7. User-Data Preservation & Upgrade Safety

- All user data lives under Electron's `app.getPath('userData')`:
  - **Windows**: `%APPDATA%\IotaPlayer\`
  - **macOS**: `~/Library/Application Support/IotaPlayer/`
  - **Linux**: `~/.config/IotaPlayer/`
- Contents:
  - `library.db` (+ `-wal` / `-shm`) — SQLite tracks, albums, artists, artwork, playlists, favorites, history, resume positions, playback state.
  - `settings/app-settings.json` — library root path, backend preference, lyrics preference, EQ & Discord settings.
- **Uninstalling or upgrading never deletes user music files or `userData`**. Schema migrations in `electron/database.ts` are versioned and wrapped in transactions.

---

## 8. Update Strategy

IotaPlayer currently uses **manual / website-linked updates** (`https://vorlie.pl/projects/iotaplayer/download` and `https://vorlie.pl/projects/iotaplayer/changelog`) rather than a background auto-updater:
- Avoids unverified unsigned auto-update prompts on Windows/macOS before signing certificates are in place.
- Once Authenticode and Apple Developer ID certificates are active, Squirrel/GitHub Releases or `update-electron-app` can be enabled cleanly without changing user data layout.
