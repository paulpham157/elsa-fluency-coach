# PRD: Fluency Coach Chrome Extension

## Problem Statement

ELSA Speak's Speech Analyzer web app displays speech analysis data (pronunciation, fluency, grammar scores; transcript; test predictors) but provides no export feature. Users who want to paste this data into Claude AI for coaching must manually transcribe scores and transcript — a slow, error-prone process. A Chrome extension can extract, structure, and format this data with one click.

## Solution

A Chrome Extension (Manifest V3) that:

- Injects a content script on `speechanalyzer.elsaspeak.com` recording pages
- When the user clicks the toolbar icon, extracts the rendered speech data from the Vue app's DOM
- Optionally navigates through each skill's detail/sub-page within the SPA to extract deeper analysis
- Formats the data as a Markdown report inside the popup
- Provides a "Copy to Clipboard" button for one-click transfer to Claude AI

## User Stories

1. As a Fluency Coach user, I want to click the extension icon on any recording page and see a structured Markdown report, so that I can paste it into Claude AI without manual transcription.

2. As a user, I want the report to include all five skill scores (Pronunciation, Intonation, Fluency, Grammar, Vocabulary), so that Claude AI has the full breakdown.

3. As a user, I want the report to include the recording transcript, so that Claude can analyze my word choices, phrasing, and grammar.

4. As a user, I want the report to include international test score predictors (IELTS, TOEFL, CEFR, PTE, TOEIC), so that I understand my proficiency level in standardized terms.

5. As a user, I want to optionally tick which skill detail pages to extract (Pronunciation, Intonation, Fluency/Pace, Fluency/Pausing, Fluency/Hesitations, Grammar, Vocabulary), so that I can get deeper analysis on specific areas without waiting for all pages.

6. As a user, I want a settings panel accessible from the popup, so that I can toggle transcript extraction, skill details, and comparison scores before extracting.

7. As a user, I want a "Copy to Clipboard" button, so that I can one-click paste the report into Claude AI.

8. As a user who opens the popup on a non-matching page, I want a clear "Open a recording page first" message, so that I am not confused by a blank popup.

9. As a user, I want the extension to detect skill detail page URLs (`/recordings/:id/pronunciation`, etc.) and extract the correct data for that skill, so that each detail page produces meaningful output.

10. As a user, I want the previous report to be restored when I re-open the popup, so that I don't lose data if I accidentally close it.

## Implementation Decisions

### Architecture

- **Flat file structure** — no bundler, no build step, no package.json. All source files at the project root, loaded as plain scripts.
- **No background service worker** — all logic lives in the popup and content script. The popup sends messages via `chrome.tabs.sendMessage`.
- **SPA in-page navigation** — instead of opening new tabs, the content script navigates the SPA by clicking tabs → clicking detail links → waiting for URL changes → extracting data → navigating back via the SPA's back button. This avoids Chrome's popup-blocker and keeps the user on one tab.

### Data Flow

```
User clicks icon → popup.html/js opens
  → chrome.tabs.query({active: true, currentWindow: true})
  → if URL doesn't match → show "Open recording page" message
  → sendMessage({type: "EXTRACT", options}) to content script
    → content.js dispatches to extractFromDom() based on URL pattern
    → returns {metadata, skills, comparison, transcript}
  → if settings have checked skill tabs:
    → for each skill:
      → sendMessage({type: "NAVIGATE_SKILL", skill})
        → content.js clicks tab → clicks link-to-text → waits for URL change
        → for fluency: additionally clicks accordion sub-item
      → sendMessage({type: "EXTRACT"}) → get detail data
      → sendMessage({type: "NAVIGATE_BACK"})
        → clicks SPA back button (handles double-back for fluency sub-pages)
      → if consecutive fluency sub-pages: skip back
  → render combined Markdown report in popup
  → persist last report to chrome.storage.local
```

### DOM Extraction

Data is not embedded in HTML — the Vue SPA fetches it dynamically. The content script must wait for Vue rendering to complete (MutationObserver + URL polling) then extract from:

- **Skill scores**: `.text-tab__percent` elements inside the tab list
- **Recording metadata**: `.recording-title__input`, `.recording-title__body-text` (date, duration, speaking time)
- **Comparison scores**: `.comparison-item__score` + `.comparison-item__max-score`
- **Transcript**: `.transcript__list` text content
- **Skill detail score/level**: `.apexcharts-datalabel-value` / `.apexcharts-datalabel-label`
- **Pronunciation sub-skills**: `.skill-item` elements inside `.skills__wrapper`
- **Pronunciation top errors**: `.error-item` elements inside `.top-error`
- **Pronunciation tutorials**: `.skill-item__video-wrapper` with YouTube video IDs
- **Intonation pitch overview**: `.pitch-overview__desc`
- **Fluency sub-scores**: `.accordion-sub-item` elements with score values
- **Fluency gauge**: `.gauge-chart__name` + `.gauge-chart__label`

### Settings Persistence

Settings stored in `chrome.storage.local`:

| Key | Type | Default | Description |
|---|---|---|---|
| `includeTranscript` | boolean | true | Include transcript text in report |
| `includeComparison` | boolean | true | Include IELTS/TOEFL/CEFR/PTE/TOEIC scores |
| `includeSkillDetails` | boolean | true | Master toggle for skill detail extraction |
| `skillDetailTabs` | string[] | [pronunciation, intonation, fluency/pace, fluency/pausing, fluency/hesitations, grammar, vocabulary] | Individual skill detail pages to visit |

### Permissions

- `activeTab` — communicate with the active tab when popup opens
- `tabs` — query active tab and send messages to content script
- `storage` — persist settings and last report across sessions

### Output Format

Markdown report rendered in the popup with sections:

```markdown
# Fluency Coach Report

**Recording**: New Recording 06-13-2026-09-20
**Date**: Sat, Jun 13th, 2026 - 09:20 am
**Duration**: 00:01:11
**Speaking Time**: 00:00:55

## Skill Scores

- **Pronunciation**: 34%
- **Intonation**: 24%
- **Fluency**: 47%
- **Grammar**: 60%
- **Vocabulary**: 73%

## Test Score Predictors

- **IELTS**: 3.5/9 (Limited)
- **TOEFL**: 9/30 (Below Basic)
- **CEFR**: A2/C2 (Basic)
- **PTE**: 14/90
- **TOEIC**: 110/200

## Skill Details

### Pronunciation

- Score: 34%
- Level: Beginner

  **Sub-skills**
  - TH Sounds: /θ/, /ð/ — Needs Improvement
  - R Sounds: /r/ — Intermediate

  **Top Errors**
  - /r/: "role, really, three"
  - /θ/: "think, three, anything"

  **Tutorials**
  - [How to Pronounce TH](https://www.youtube.com/watch?v=abc123)

### Pace

  **Fluency Breakdown**
  - Pace: 69 wpm (Natural)
  - Pausing: 56% (Acceptable)
  - Hesitations: 12 (Few)

  - **Current**: 69 wpm (Natural)

## Transcript

00:00:01 Why are you interested in the role of company?
...
```

### Test Seam

Three pure functions exposed to tests via the content script's `lib/extract.js`:

1. `extractFromDom(document, options)` — overall page extraction
2. `extractMainSkillDetail(document, skill)` — skill detail page extraction
3. `extractFluencySubPage(document, skill)` — fluency sub-page extraction

These have no side effects (no `chrome.*`, no DOM mutation) and can be tested by passing document fragments or HTML fixtures.

### Navigation Edge Cases

- **Tab bar** (`.wrapper-tabs`) exists **only** on the overall page — confirmed by both static HTML and live console check
- **Double-back from fluency sub-pages**: fluency sub-page → fluency detail (`.recording-detail-score`) → overall (`.wrapper-tabs`)
- **Consecutive fluency sub-pages**: skip the back step entirely — click accordion sub-item directly
- **Do NOT use `history.back()`** — the recording page URL may be the browser's only history entry for this origin, causing history.back() to exit the SPA entirely

## Testing Decisions

### Testing Approach

Use QUnit test runner in a single HTML page (`tests/index.html`). Tests exercise the extraction functions by constructing DOM fixtures or loading saved HTML files.

### Behaviors Tested

1. Extract 5 skill scores from the tab list DOM
2. Extract recording metadata (title, date, duration, speaking time)
3. Extract comparison scores (IELTS, TOEFL, etc.)
4. Extract transcript text
5. Handle N/A scores for short recordings
6. Render `RecordingData` to Markdown string (all sections)
7. Render minimal report with N/A data
8. Render skill detail with subSkills, topErrors, tutorials
9. Render fluency sub-page with subScores and gauge
10. Render intonation detail with pitch overview
11. Render "no result" for too-short recordings

## Out of Scope

- Auto-sending data to Claude AI or any third-party service
- Batch export of multiple recordings in one session
- Background sync or data persistence beyond the popup session
- Editing or annotating extracted data within the extension
- Any backend server, database, or API
- Recording management (delete, rename, share within the extension)
- Authentication handling (relies on user being already logged into ELSA)
- Mobile browser support (Chrome desktop only)

## Further Notes

- The ELSA Speech Analyzer is a Vue 3 SPA with Vue Router (history mode). Scores are rendered via ApexCharts. These are dynamic DOM elements — the content script must wait for Vue to paint before extracting.
- The recording ID in the URL path (`/recordings/:id`) uniquely identifies each recording.
- Skill detail pages follow the pattern `/recordings/:id/{pronunciation|intonation|fluency|grammar|vocabulary}`.
- Fluency sub-pages follow the pattern `/recordings/:id/fluency/{pace|pausing|hesitations}`.
- The extension has no dependency on ELSA's internal API — it reads only what is already rendered on screen. This makes it robust against API changes but fragile against UI restructuring.
- This repo has no issue tracker. This PRD is saved as a local file. When a GitHub issue tracker is added, create issues for each user story and apply the `ready-for-agent` label.
