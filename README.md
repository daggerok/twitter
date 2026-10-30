# X Feed Sheets (daggerok/twitter)

Follow X (Twitter) accounts into your own Google Sheet and read them in a viewer on GitHub Pages. A Tampermonkey userscript collects the posts of a profile while it scrolls in your logged-in browser; the viewer stores them in Google Sheets (one tab per account) and shows them with filters, search and export. No X API, no server, no secrets in code, $0

Live: https://daggerok.github.io/twitter/

Userscript: https://daggerok.github.io/twitter/x-sync.user.js

The first version (a DOM scraper with copy and paste into a dashboard) is kept on the branch `backup/v1-2026-08-16` and the tag `v1-backup`

## How it works

```
x.com (logged in)                       daggerok.github.io/twitter (viewer)          Google
+---------------------------+           +---------------------------------+          +---------------+
| userscript x-sync.user.js |  GM store | the same userscript: bridge     | Sheets   | your          |
| fetch/XHR interceptor ->  | --------> | postMessage -> page             | API v4   | spreadsheet   |
| GraphQL parser -> posts   |  outbox   | viewer: merge, write, ack       | -------> | X-<handle>    |
| auto-scroll + badge       | <-------- | meta: newest stored id          | GIS OAuth| tabs          |
+---------------------------+  meta     +---------------------------------+          +---------------+
```

- A static site cannot read x.com (same origin policy, X blocks frames), so collection runs in a Tampermonkey userscript on x.com. It wraps `fetch` and `XMLHttpRequest` of the page at `document-start` and parses the GraphQL timeline responses X itself loads (`UserTweets`, `UserTweetsAndReplies`, `UserMedia`), matching the operation name only, never a query id. When no response was seen for 10 s it falls back to the rendered `article[data-testid="tweet"]` cards (fewer fields)
- The userscript also runs on the viewer origin. Tampermonkey storage is shared between both pages of one script, so the posts captured on x.com reach the viewer with no server: `GM_setValue` outbox on x.com, `postMessage` bridge on the viewer, ack when stored. The viewer sends back the newest stored id per account, which is where an incremental run stops
- Storage is the daggerok/youtube way: Google Identity Services in the browser, only the public OAuth Client ID and the spreadsheet id in localStorage, the token in memory (silent renewal, one retry on a 401), the Sheets API called directly. One tab `X-<handle>` per account, header row frozen, one row per post, newest first. Writes overwrite rows 2..n+1 in one PUT and then clear the tail, so a failed write leaves the old rows in place
- Without the userscript on the viewer's browser (another machine), the badge on x.com has a JSON button and the viewer an Import JSON button

## Setup (once)

1. Google Cloud: at https://console.cloud.google.com/ create or pick a project, enable the Google Sheets API, set up the OAuth consent screen (External, your email under Test users) and create an OAuth 2.0 Client ID of type Web application with the authorized JavaScript origins `https://daggerok.github.io` (and `http://localhost:1234` for `bun run serve`). No redirect uri, no client secret
2. Open the viewer, paste the Client ID in Settings, press Connect Google, then Create spreadsheet (or paste the url of one you made)
3. Install Tampermonkey. Chrome 138+: open the extension details and turn on Allow User Scripts (or Developer mode at chrome://extensions). Site access must include x.com
4. Install the userscript from the link above (or the Install userscript button). Reload the viewer: the header badge shows `script v2.x`
5. Add a handle and press Sync new. The profile opens on x.com with `#xsync=incremental`, the corner badge scrolls the timeline and shows posts seen, elapsed time and a Stop button. When it stops, go back to the viewer: the posts are merged into the sheet and the feed shows them

Settings of a run (badge ⚙ or the Tampermonkey menu): max posts (2000), max minutes (15), delay between scrolls (1.5 to 4 s), a rest every 20 scrolls (5 to 12 s), stop after 8 scrolls without new posts, replies too (the viewer then opens `/with_replies`)

## Viewer

- Accounts: Sync new (incremental, stops at the newest stored post), Full sync (the whole visible timeline again, counts refreshed), Reload (read the tab), Remove (the list only), Delete tab (the spreadsheet too), Find accounts in the sheet (every `X-<handle>` tab)
- Feed: filter by account (click the handle), type (post, reply, repost, quote), has media, date range, text search (every word must match text, author, handle or links), sort by date, likes, views, reposts or replies; 50 cards at a time; CSV and JSON of the filtered view
- Import JSON: the file the badge's JSON button downloads on x.com
- Light and dark theme, mobile layout; the config, the account list and a copy of the posts stay in localStorage (every access in try/catch), the Google token only in memory

## Sheet columns

`id, handle, author_name, created_at, type, text, lang, url, in_reply_to_id, in_reply_to_handle, conversation_id, quoted_id, reposted_id, reposted_handle, media, links, likes, reposts, replies, quotes, bookmarks, views, is_pinned, first_seen_at, last_seen_at`

Ids are written as text (`valueInputOption=RAW`) because they exceed the safe integer range; `media` and `links` are JSON arrays; a long post takes its `note_tweet` text; `t.co` links are expanded; a repost carries the original author and text; cells are cut at 50,000 characters with `…[truncated]`

## Development

```bash
bun install -E
bun test                 # parser (fixture of a UserTweets payload), sheet rows, filters, settings, header
bun run build            # viewer to dist/ and the userscript to dist/x-sync.user.js
bun run serve            # http://localhost:1234 (add it to the OAuth origins for a local test)
bun run userscript       # the userscript alone
```

Layout: `src/` the viewer (React 19, Parcel, Tailwind 4, no tsconfig), `userscript/src/` the Tampermonkey script bundled by `scripts/build-userscript.ts` with `Bun.build` (header in `userscript/header.ts`), `shared/post.ts` the record and sheet row layout both use

Manual end to end check: install the script, set the Client ID and spreadsheet, Full sync of a small account, rows appear in the tab; run Sync new again, zero new rows and `last_seen_at` refreshed; the feed filters and exports them

## Known limits

- X exposes a limited depth of a profile timeline (often a few hundred to about 3,200 posts); older posts are out of reach
- X changes its internal API; when `UserTweets` stops being recognised the DOM fallback keeps ids, dates, text and media and the parser needs an update (fixture in `userscript/src/fixtures/`)
- Automated collection is against X's Terms of Service. Use it moderately on a few accounts you follow, with the slow default pacing, at your own risk
- Replies of other users under a post (`TweetDetail`), media files to Drive and runs without your browser open are out of scope

## License

MIT
