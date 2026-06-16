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
| `popup.html` | Present |
| `content.js` | Present |
| `popup.js` | Present |
| `lib/extract.js` | Present |
| `icons/*.png` | Present (16/32/48/128px) |

## No tests, no lint, no CI

Not yet set up. If adding, prefer native Chrome extension workflow (no bundler).

## Notable

- `activeTab` permission means the popup only has access to the active tab while open — do not assume background access to arbitrary URLs.
- The content script match pattern is exact — it will not inject on subdomains or paths outside `speechanalyzer.elsaspeak.com`.

## Navigation Architecture

SPA navigation uses Vue Router (history mode) — no `hash` fragments.

### Forward navigation (overall → detail)
1. Click skill tab (`.wrapper-tabs__tab-item` matching `.text-tab__skill` text)
2. Click `.link-to-text` `<a>` tag (triggers Vue Router push), scoped as `.{skillBase}-tab .link-to-text`
3. Wait for URL to include the skill path via `waitForUrl('/{skillBase}$')`

For fluency: after `.link-to-text` click, additionally click the accordion sub-item (`.accordion-sub-item` matching `.accordion-sub-item__title-large` text), then wait for URL to include the sub-page path (`waitForUrl('/' + subSkill + '$')`). Accordion items are `<dl>` elements with Vue Router click handlers (not `<a>` tags).

### Navigation between skills
Always navigate back to the overall page between skills (except consecutive fluency sub-pages):

1. **Back (detail → overall)**: Click `.recording-overall__back` (present on all detail/sub-pages, absent on overall). Wait for `.wrapper-tabs`.
2. **Back (fluency sub-page → overall)**: Double-back — first back goes to fluency detail (wait for `.recording-detail-score`), second back goes to overall (wait for `.wrapper-tabs`).
3. **Fluency sub-page → sub-page**: Skip back; click accordion sub-item directly (`<dl>` elements with Vue Router click handlers, present on all sub-pages).

Do NOT use `history.back()` — the recording page URL may be the browser's only history entry for this origin, causing `history.back()` to exit the SPA entirely.

Tab bar (`.wrapper-tabs`) exists ONLY on the overall page — confirmed by both static HTML and live console check. Do not attempt tab clicks from detail pages.

### `waitForEl` pattern
`waitForEl(selector, callback, timeout)` uses MutationObserver on `document.body`. When the selector matches, `callback(el)` fires. On timeout, `callback(null)` fires — callbacks MUST check `!el` before proceeding.

### `waitForUrl` pattern
`waitForUrl(urlPattern, callback, timeout)` polls `window.location.pathname` every 100ms until the regex pattern matches or timeout fires. Passes `true`/`false` to callback.

### URL patterns (live-verified)
| Page | URL | DOM markers |
|---|---|---|
| Recording listing | `/recordings` | No `.wrapper-tabs`, no `.recording-overall__back` |
| Overall detail | `/recordings/{id}` | `.wrapper-tabs` + `.recording-overall__back` |
| Skill detail | `/recordings/{id}/{skill}` | `.recording-detail-score` + `.recording-overall__back` |
| Fluency sub-page | `/recordings/{id}/fluency/{sub}` | `.accordion-sub-item` + `.recording-overall__back` |

### Verified selectors (via live DOM inspection)
- `.recording-overall__back`: present on all detail/sub-pages, absent on overall/listing
- `.recording-detail-score`: present on all skill detail pages, absent on overall/listing
- `.wrapper-tabs`: container class on overall page; contains `.wrapper-tabs__tab-item` (5 skill tabs) — absent on detail/sub-pages
- `.link-to-text`: present in overall page tab content, scoped as `.{skillBase}-tab .link-to-text`

### Known extraction quirks
- `extractMainSkillDetail` selects `.recording-detail-score .apexcharts-datalabel-value` for the score — must scope within `.recording-detail-score` because the overall page's overview radial charts also match `.apexcharts-datalabel-value` with "0%"
- Accordion sub-items are `<dl>` elements (not `<a>`), have no `href` — `item.click()` works via Vue Router handlers
