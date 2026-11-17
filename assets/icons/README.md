# IotaPlayer Application Icons

All platform icons are generated from a single vector source of truth:

- **Master SVG**: [iotaplayer.svg](file:///d:/Projekty/iotaplayer-rewrite/assets/icons/iotaplayer.svg)

## Design Tokens

| Element | Color | Role |
| :--- | :--- | :--- |
| Rounded-square container | `#110d0d` (stroke `#2b2222`) | Obsidian app badge |
| Central Iota pillar & crown dot | `#ffa7a7` | Primary recognizable `i` / Iota mark |
| Left equalizer bar | `#a89393` | Secondary audio detail |
| Right equalizer bar | `#ede4e4` | Secondary audio detail |

## Generated Platform Assets

- **Windows**: `assets/icons/win/icon.ico` — multi-resolution ICO (`16`, `24`, `32`, `48`, `64`, `128`, `256`).
- **macOS**: `assets/icons/mac/icon.icns` — PNG-backed ICNS (`icp4` 16px through `ic10` 1024px) with ~8% optical safe-area padding for macOS squircle grids.
- **Linux**: `assets/icons/linux/{16x16,24x24,32x32,48x48,64x64,128x128,256x256,512x512}.png` and `assets/icons/linux/iotaplayer.svg`.
- **Web / Renderer Favicon**: `public/favicon.svg` (synced from `iotaplayer.svg`).

## Regenerating Assets

Edit `assets/icons/iotaplayer.svg`, then run:

```bash
uv run --with resvg-py --with pillow python scripts/generate-icons.py
```
