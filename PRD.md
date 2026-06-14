# PRD: Fluency Coach Chrome Extension

## Problem Statement

ELSA Speak's Speech Analyzer web app displays speech analysis data (pronunciation, fluency, grammar scores; transcript; test predictors) but provides no export feature. Users who want to paste this data into Claude AI for coaching must manually transcribe scores and transcript — a slow, error-prone process. A Chrome extension can extract, structure, and format this data with one click.

## Solution

A Chrome Extension (Manifest V3) that:

- Injects a content script on `speechanalyzer.elsaspeak.com` recording pages
- When the user clicks the toolbar icon, extracts the rendered speech data from the Vue app's DOM
- Formats the data as a Markdown report inside the popup
- Provides a "Copy to Clipboard" button for one-click transfer to Claude AI

The extension extracts from the Overall page by default. Optionally, the user can configure it to also open skill detail pages (Pronunciation, Intonation, Fluency, Grammar, Vocabulary) to extract deeper analysis — each in a separate tab that closes automatically when complete.

## User Stories

1. As a Fluency Coach user, I want to click the extension icon on any recording page and see a structured Markdown report, so that I can paste it into Claude AI without manual transcription.

2. As a user, I want the report to include my overall ELSA score (the radial gauge value), so that I know my general speaking level.

3. As a user, I want the report to include all five skill scores (Pronunciation, Intonation, Fluency, Grammar, Vocabulary), so that Claude AI has the full breakdown.

4. As a user, I want the report to include the recording transcript, so that Claude can analyze my word choices, phrasing, and grammar.

5. As a user, I want the report to include international test score predictors (IELTS, TOEFL, CEFR, PTE, TOEIC), so that I understand my proficiency level in standardized terms.

6. As a user, I want to optionally tick which skill detail pages to extract (Pronunciation, Intonation, Fluency, Grammar, Vocabulary), so that I can get deeper analysis on specific areas without waiting for all pages.

7. As a user, I want a settings panel accessible from the popup, so that I can toggle transcript extraction, skill details, and comparison scores before extracting.

8. As a user, I want a "Copy to Clipboard" button, so that I can one-click paste the report into Claude AI.

9. As a user who opens the popup on a non-matching page, I want a clear "Open a recording page first" message, so that I am not confused by a blank popup.

10. As a user, I want the extension to detect skill detail page URLs (`/recordings/:id/pronunciation`, etc.) and extract the correct data for that skill, so that each detail page produces meaningful output.

## Implementation Decisions

### Architecture

- **Flat file structure** — no bundler, no build step, no package.json. All source files at the project root, plain ES modules (where Chrome MV3 allows) or inline scripts.
- **No background service worker** — all logic lives in the popup and content script. The popup sends messages via `chrome.tabs.sendMessage` and `tabs.create` for skill detail pages.

### Data Flow

```
User clicks icon → popup.html/js opens
  → chrome.tabs.query({active: true, currentWindow: true})
  → if URL doesn't match → show "Open recording page" message
  → if URL matches Overall page → sendMessage({type: "EXTRACT_OVERALL"})
    → content.js reads Vue-rendered DOM → returns RecordingData
  → if settings have checked skill tabs → chrome.tabs.create() per skill
    → content.js auto-detects URL pattern → extracts skill-specific data
    → popup collects results, closes tabs
  → render Markdown in popup
```

### DOM Extraction

Data is not embedded in HTML — the Vue SPA fetches it dynamically. The content script must wait for Vue rendering to complete (observe DOM or use a small timeout) then extract from:

- **Skill scores**: `.text-tab__percent` elements inside the tab list
- **Recording metadata**: `.recording-title__input`, `.recording-title__body-text` (date, duration, speaking time)
- **Comparison scores**: `.comparison-item__score` + `.comparison-item__progress` width
- **Transcript**: `.transcript__list` children after the audio player loads
- **Overall score**: ApexCharts radial gauge value (`text-tab__percent` or `overall-score` sections)

### Settings Persistence

Settings stored in `chrome.storage.local`:

| Key | Type | Default | Description |
|---|---|---|---|
| `includeTranscript` | boolean | true | Include transcript text in report |
| `includeComparison` | boolean | true | Include IELTS/TOEFL/CEFR/PTE/TOEIC scores |
| `skillDetails` | string[] | [] | Array of skill slugs: "pronunciation", "intonation", "fluency", "grammar", "vocabulary" |

### Permissions

- `activeTab` — communicate with the active tab when popup opens
- `tabs` — create new tabs for skill detail pages (only after user interaction with popup)
- `storage` — persist settings across sessions

### Output Format

Markdown report rendered in the popup with sections:

```markdown
## Fluency Coach Report
**Date**: Wed, Jun 10th, 2026
**Duration**: 00:01:23

### Overall Score
85%

### Skill Breakdown
- Pronunciation: 82%
- Intonation: 78%
- Fluency: 90%
- Grammar: 75%
- Vocabulary: 80%

### Score Predictors
- IELTS: 6.5/9
- TOEFL: 22/30
- CEFR: B2/C2
- PTE: 58/90
- TOEIC: 150/200

### Transcript
[full transcript text]
```

## Testing Decisions

### Testing Approach

Follow TDD with vertical tracer bullets. Test behavior through the `extractFromDom(document, options)` pure function, which is the only public interface of the data-extraction module.

### Seam

A single pure function `extractFromDom(document, options) → RecordingData`:

- **Input**: DOM (can pass a real document fragment or a fixture) + options object
- **Output**: `{ metadata, skills, comparison, transcript }` — plain object containing all extracted data
- **No side effects**: doesn't call chrome.*, doesn't change DOM, doesn't touch storage
- **Testable in isolation**: provide known DOM fixtures, assert exact output shape

### Behaviors to Test (priority order)

1. Extract 5 skill scores from the tab list DOM
2. Extract recording metadata (title, date, duration, speaking time)
3. Extract comparison scores
4. Extract transcript text
5. Detect skill page URL pattern and extract corresponding skill detail
6. Render `RecordingData` to Markdown string

### No Test Infrastructure Yet

Project currently has no test runner, no package.json, no CI. The first test will require setting up a minimal test harness. Prefer the native Chrome extension workflow — no bundler. A lightweight setup like a single HTML test page with `QUnit` or plain assertions in a `tests/` directory is appropriate.

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

- The ELSA Speech Analyzer is a Vue 3 SPA. Scores are rendered via ApexCharts. These are dynamic DOM elements — the content script must wait for Vue to paint before extracting.
- The recording ID in the URL path (`/recordings/:id`) uniquely identifies each recording.
- Skill detail pages follow the pattern `/recordings/:id/{pronunciation|intonation|fluency|grammar|vocabulary}`.
- The extension has no dependency on ELSA's internal API — it reads only what is already rendered on screen. This makes it robust against API changes but fragile against UI restructuring.
- This repo has no issue tracker. This PRD is saved as a local file. When a GitHub issue tracker is added, create issues for each user story and apply the `ready-for-agent` label.
