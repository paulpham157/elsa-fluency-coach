# Fluency Coach — Chrome Extension

## Quick start

No build step — this is a plain Manifest V3 extension. Load it via `chrome://extensions` → Load unpacked, point at this directory.

## Manifest essentials

- `content.js` runs on `https://speechanalyzer.elsaspeak.com/*` only.
- `popup.html` is the action popup (no framework, plain HTML/JS).
- Permission: `activeTab` only. No host permissions beyond the content script match.
- Icons live in `icons/` (directory exists but empty — needs 16/32/48/128px PNGs before publishing).

## Source files

All files are flat at the root — no bundler, no build pipeline, no package.json. Create files directly:

| File | Status |
|---|---|
| `manifest.json` | Present |
| `popup.html` | Not yet created |
| `content.js` | Not yet created |
| `icons/*.png` | Not yet created |

## No tests, no lint, no CI

Not yet set up. If adding, prefer native Chrome extension workflow (no bundler).

## Notable

- `activeTab` permission means the popup only has access to the active tab while open — do not assume background access to arbitrary URLs.
- The content script match pattern is exact — it will not inject on subdomains or paths outside `speechanalyzer.elsaspeak.com`.
