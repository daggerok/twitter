# X / Twitter Timeline Dashboard

A mobile-first, browser-only tracker for public X timelines, styled and structured like [`daggerok/youtube`](https://github.com/daggerok/youtube).

Live dashboard: <https://daggerok.github.io/twitter/>

## How the free collector works

X's free embedded timeline is unreliable and frequently returns HTTP 429. X's official data API is pay-per-use. This project therefore provides an optional logged-in-browser collector:

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Install [`collector.user.js`](https://daggerok.github.io/twitter/collector.user.js).
3. Log into X normally and open [`@I_Am_The_ICT` Posts & replies](https://x.com/I_Am_The_ICT/with_replies).
4. Use the floating **ICT Collector** panel:
   - **Start Manual** records rendered tweet cards while you scroll.
   - **Start + Auto** performs slow, capped assisted scrolling.
   - **Pause** stops immediately.
5. Choose **Copy New JSON** or **Download JSON**.
6. Return to the dashboard and use **📋 Paste** or the **📄 JSON import** dialog.

No X password, session cookie, authorization token, or private browser storage is copied to the dashboard. The collector observes only tweet cards rendered in the current X page.

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
