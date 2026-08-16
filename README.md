# X / Twitter Timeline Dashboard

A mobile-first, browser-only tracker for public X timelines, styled and structured like [`daggerok/youtube`](https://github.com/daggerok/youtube).

Live dashboard: <https://daggerok.github.io/twitter/>

## How the free collector works

X's free embedded timeline is unreliable and frequently returns HTTP 429. X's official data API is pay-per-use. This project therefore provides an optional logged-in-browser collector:

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. **Allow Chrome to execute userscripts:**
   - Right-click Tampermonkey → **Manage extension**.
   - Turn on **Allow User Scripts**. Chrome 138+ requires this even when Tampermonkey and the script both appear enabled.
   - If the toggle is unavailable, enable **Developer mode** at `chrome://extensions`.
   - Set Tampermonkey site access to **On all sites**, or at least allow `x.com`.
   - See [Tampermonkey FAQ Q209](https://www.tampermonkey.net/faq.php?locale=en#Q209).
3. Install or update [`collector.user.js`](https://daggerok.github.io/twitter/collector.user.js). Confirm version **1.1.0**.
4. Log into X normally and open [`@I_Am_The_ICT` Posts & replies](https://x.com/I_Am_The_ICT/with_replies).
5. Hard-reload the X tab after installation: **Ctrl+Shift+R** on Windows/Linux or **Cmd+Shift+R** on macOS.
6. Confirm that the floating **𝕏 ICT Collector** panel appears at the bottom-right:
   - **Start Manual** records rendered tweet cards while you scroll.
   - **Start + Auto** performs slow, capped assisted scrolling.
   - **Pause** stops immediately.
7. Choose **Copy New JSON** or **Download JSON**.
8. Return to the dashboard and use **📋 Paste** or the **📄 JSON import** dialog.

No X password, session cookie, authorization token, or private browser storage is copied to the dashboard. The collector observes only tweet cards rendered in the current X page.

## If the panel is missing

Check these in order:

1. Tampermonkey's global status is **Enabled**.
2. The `daggerok X Timeline Collector` toggle is green.
3. Chrome's Tampermonkey extension details have **Allow User Scripts** enabled.
4. Tampermonkey site access allows `https://x.com/*`.
5. The installed collector version is **1.1.0**.
6. Hard-reload the X tab after installing or updating the script.
7. Open Tampermonkey on the X tab and run **Show / reopen ICT Collector panel**.
8. In DevTools Console, successful execution logs:
   ```text
   [daggerok X Collector] userscript v1.1.0 loaded
   ```

The collector now mounts its panel before loading Tampermonkey storage, so a storage error is displayed in the panel rather than causing an invisible startup failure.

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
- stores only post IDs in Tampermonkey storage to recognize previous captures

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
- [`collector.user.js`](./collector.user.js) — Tampermonkey companion that observes rendered X tweet cards
