# X / Twitter Timeline Dashboard

A mobile-first, browser-only tracker for public X timelines, styled and structured like [`daggerok/youtube`](https://github.com/daggerok/youtube).

Live dashboard: <https://daggerok.github.io/twitter/>

## Free logged-in Chrome collector

X's free embedded timeline is unreliable and frequently returns HTTP 429. X's official data API is pay-per-use. This project therefore provides an unpacked Chromium extension that collects tweet cards rendered in your already logged-in X tab.

The Chrome extension replaces the earlier Tampermonkey userscript.

## Install the extension

1. Disable or remove the old **daggerok X Timeline Collector** userscript from Tampermonkey.
2. Download [`twitter-collector-extension.zip`](https://daggerok.github.io/twitter/twitter-collector-extension.zip).
3. Unzip it. The extracted `extension` folder must directly contain `manifest.json`.
4. Open `chrome://extensions`.
5. Enable **Developer mode** in the top-right.
6. Click **Load unpacked**.
7. Select the extracted `extension` folder—not the ZIP and not the repository root.
8. Pin **daggerok X Timeline Collector** to the browser toolbar.

The source is also available in [`extension/`](./extension/).

## Daily usage

1. Log into X normally and open [`@I_Am_The_ICT` Posts & replies](https://x.com/I_Am_The_ICT/with_replies).
2. Click the **daggerok X Timeline Collector** extension icon while the X tab is active.
3. The popup shows whether the collector content script is loaded. It automatically injects/reinjects the script when needed.
4. Choose:
   - **Show panel** — display/reopen the floating controls.
   - **Start Manual** — collect rendered tweet cards while you scroll.
   - **Start Auto** — perform slow, capped assisted scrolling.
   - **Pause** — stop immediately.
5. Choose **Copy New JSON** in the popup or floating panel, or download JSON from the panel.
6. Return to <https://daggerok.github.io/twitter/> and use **📋 Paste** or the **📄 JSON import** dialog.

No X password, session cookie, authorization token, or private X browser storage is exported. The extension observes only tweet cards rendered in the current X page.

## If the panel is missing

Check these in order:

1. The unpacked extension is enabled at `chrome://extensions`.
2. The folder loaded into Chrome directly contains `manifest.json`.
3. The extension's site access permits `https://x.com/*`.
4. You are on the X profile tab—not the dashboard—when opening the extension popup.
5. Click **Show panel**. The popup attempts a direct content-script reinjection when no receiver is detected.
6. Reload the X tab once after first installing or reloading the unpacked extension.
7. Open DevTools Console and look for:
   ```text
   [daggerok X Collector] Chrome extension v1.0.0 loaded
   ```

## Dashboard features

- Defaults to `@I_Am_The_ICT`, but supports other public profile handles.
- Heuristically classifies captured cards as new posts, self-thread follow-ups, replies, reposts, or quotes.
- Merges and deduplicates captures by post ID.
- Caches records, statuses, notes, filters, and preferences in dashboard `localStorage`.
- Optionally syncs records to Google Sheets using one `TW-@handle` tab per profile.
- Preserves visible metrics, media URLs, capture time, and rendered reply/repost context.
- Supports filters, statuses, notes, CSV export, and responsive desktop/mobile views.

## Collector safety controls

Assisted scrolling is deliberately conservative:

- explicit user start and pause controls
- configurable 1.8–6 second delay
- configurable scroll cap, defaulting to 80
- stops after repeated scans with no new rendered posts
- stops after reaching posts seen in an earlier collector run
- stores only post IDs in `chrome.storage.local` to recognize previous captures

## Important limitations and Terms

- Collection is limited to cards X actually renders for the logged-in user.
- X virtualizes its timeline, changes its DOM frequently, and may omit or reorder posts.
- Reply/thread/quote classification is heuristic because the rendered DOM exposes less metadata than the API.
- Assisted scrolling may trigger X anti-automation protections or account rate limits.
- X's current Terms state that scraping without express written permission is prohibited. Review [X's Terms of Service](https://x.com/en/tos) and use this collector only if you accept the account and Terms risk.

## Google Sheets

Open **⚙️ Settings** in the dashboard and expand **📋 Google Sheets Setup (per-channel tabs)**. The Google OAuth access token remains in memory; the public OAuth Client ID and Spreadsheet ID are stored in dashboard `localStorage`.

## Files

- [`index.html`](./index.html) — dashboard, cache, classification, filtering, CSV, and Google Sheets sync
- [`extension/manifest.json`](./extension/manifest.json) — Manifest V3 extension configuration
- [`extension/content.js`](./extension/content.js) — collector injected into X profile pages
- [`extension/popup.html`](./extension/popup.html) and [`popup.js`](./extension/popup.js) — toolbar controls and reinjection diagnostics
- `twitter-collector-extension.zip` — downloadable unpacked-extension package
