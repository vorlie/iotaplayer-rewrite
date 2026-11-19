# Credits & Third-Party Notices

IotaPlayer is developed by **vorlie** ([vorlie.pl](https://vorlie.pl/projects/iotaplayer)). This project relies on open-source software, specifications, and design inspirations listed below.

---

## Visual & Format Acknowledgements

- **Still — Minimal Wallpaper for Your Focus** ([Steam Workshop #3829782620](https://steamcommunity.com/sharedfiles/filedetails/?id=3829782620))
  Visual inspiration for the optional **Still** fullscreen style in `src/components/StillAmbientCanvas.tsx` and `src/components/FullscreenNowPlaying.tsx`, including the OKLab Flow mesh & silk-sheen light field shader, static triangular-distribution film-grain tile, and centered floating lyrics stage.
- **Lyricsfile 1.0 Specification** ([tranxuanthang/lyricsfile](https://github.com/tranxuanthang/lyricsfile/blob/main/SPECIFICATION.md))
  Format specification for `.lyricsfile.yaml` word- and line-synchronized lyrics.

---

## Runtime & Build Dependencies

| Package | Version | License | Source |
| :--- | :--- | :--- | :--- |
| `better-sqlite3` | `13.0.3` | MIT | https://github.com/WiseLibs/better-sqlite3 |
| `discord-rpc` | `4.0.1` | MIT | https://github.com/discordjs/RPC |
| `esbuild` | `0.28.2` | MIT | https://github.com/evanw/esbuild |
| `i18next` | `27.2.1` | MIT | https://www.i18next.com |
| `lucide-react` | `1.48.0` | ISC | https://lucide.dev |
| `music-metadata` | `11.16.1` | MIT | https://github.com/Borewit/music-metadata |
| `react` | `19.3.0` | MIT | https://react.dev |
| `react-dom` | `19.3.0` | MIT | https://react.dev |
| `react-i18next` | `18.0.3` | MIT | https://github.com/i18next/react-i18next |
| `zustand` | `5.0.15` | MIT | https://github.com/pmndrs/zustand |

---

## Platform, Media Backend & Typography

- **Electron** (`^44.4.5`, MIT) — Cross-platform desktop application shell (https://www.electronjs.org).
- **mpv** (GPL-2.0-or-later / LGPL-2.1-or-later) — Optional external media player invoked over IPC when installed on the user's system `PATH` (https://mpv.io).
- **Outfit** (SIL Open Font License 1.1) — Primary UI typeface.
- **Vite** (`^8.3.0`, MIT), **TypeScript** (`~6.0.2`, Apache-2.0), **ESLint** (`^10.10.0`, MIT), and **Electron Forge** / **electron-builder** (MIT).
