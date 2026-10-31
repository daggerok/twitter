# X Feed Sheets (daggerok/twitter)

Follow X (Twitter) accounts into your own Google Sheet and read them in a viewer on GitHub Pages. A Tampermonkey userscript collects the posts of a profile while it scrolls in your logged-in browser; the viewer stores them in Google Sheets (one tab per account) and shows them with filters, search and export. No X API, no server, no secrets in code, $0

Live: https://daggerok.github.io/twitter/

Userscript: https://daggerok.github.io/twitter/x-sync.user.js

The first version (a DOM scraper with copy and paste into a dashboard) is kept on the branch `backup/v1-2026-08-16` and the tag `v1-backup`

## How it works, in plain words

x.com lets nobody read a timeline from outside: the posts exist only in your own logged-in browser. Tampermonkey is a Chrome extension that runs small programs, userscripts, one `.user.js` file each, on the sites you allow it. Our file `x-sync.user.js` is such a program: on x.com it scrolls a profile and remembers the posts; on the viewer page the same file hands them to the viewer, which writes them to your Google Sheet. So Tampermonkey needs access to two sites, `x.com` and `daggerok.github.io`; with x.com only, the install link shows raw code instead of the install page and the posts never reach the sheet. The Google Sheet is just the storage: the viewer writes to it from the browser after you press Connect Google, no keys or passwords anywhere

## How it works, in detail

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

Prerequisites, when the ids are already in a local `google.json` (never committed, see .gitignore; the same file daggerok/youtube uses):

```bash
jq -r '."Google OAuth Web Client ID"' google.json | pbcopy        # Settings -> Google OAuth Client ID
jq -r '."Google Sheets Spreadsheet full URL"' google.json | pbcopy # Settings -> Spreadsheet url or id
```

1. Google Cloud: at https://console.cloud.google.com/ create or pick a project, enable the Google Sheets API, set up the OAuth consent screen (External, your email under Test users) and create an OAuth 2.0 Client ID of type Web application with the authorized JavaScript origins `https://daggerok.github.io` (and `http://localhost:1234` for `bun run serve`). No redirect uri, no client secret
2. Open the viewer, paste the Client ID in Settings, press Connect Google, then Create spreadsheet (or paste the url of one you made)
3. Install Tampermonkey. Chrome 138+: open the extension details and turn on Allow User Scripts (or Developer mode at chrome://extensions). Site access must include both `https://x.com/*` and `https://daggerok.github.io/*` (the script runs on the viewer too, that is how the posts get from x.com to the sheet)
4. Open the userscript link above: a `.user.js` url is intercepted by Tampermonkey, which shows its install page with the script name, its grants and an Install button. Press Install (if the raw code opened instead: Tampermonkey icon, Dashboard, Utilities, Install from URL). Reload the viewer: the first dot on the toolbar turns green
5. Type a handle in the top field, press Enter, then ⬇ Sync new in the Accounts list. The profile opens on x.com with `#xsync=incremental`, the corner badge scrolls the timeline and shows posts seen, elapsed time and a Stop button. When it stops, go back to the viewer: the posts are merged into the sheet and the feed shows them

Settings of a run (badge ⚙ or the Tampermonkey menu): max posts and max minutes (0 = no limit, the default: a run goes on until the timeline ends, X rate limits it or you press Stop), delay between scrolls (1.5 to 4 s), a rest every 20 scrolls (5 to 12 s), stop after 8 scrolls without new posts, replies too (the viewer then opens `/with_replies`)

## Viewer

The shell is the daggerok/youtube one, one account at a time: the field holds the profile link or handle (Enter shows what the sheet already has for it) and the toolbar is ⚙️ Setup (slides open and closed), two status dots (green = userscript installed in this browser, blue = Google Sheets connected; the button opens the debug console), ⬇ Update (sync the new posts, opens x.com), 🔄 Full refresh (the whole visible timeline again, counts refreshed), ☁️ Connect Google or 🔌 Disconnect, ↻ reload the tab from the sheet, 📥 CSV, 🌙 or ☀ theme. Client ID, spreadsheet url and the connected email are masked with dots, 👁 shows and 📋 copies them; Import JSON, Create new spreadsheet, Attach / list tabs and the "sync replies too" switch sit in Setup

- Another account: type its link or handle in the field and press ⬇ (or Enter for the stored posts); every account keeps its own `X-<handle>` tab, the feed shows the one in the field
- Feed: the youtube table. Click a header to sort (▼ ▲), type in the filter box under it; the syntax is the youtube one, case-insensitive: `a*b` or `a&b` = a then b in order, `a|b` = either, spaces count, no quotes. Datetime filters the shown date, Type knows `post`, `reply`, `repost`, `quote`, `pinned`, `photo`, `video`, `gif`, `media` and `text only`, Post searches the text, author, handle and links, Hidden takes `hidden` or `visible`. The 🖼 dropdown in the Type header ticks the media kinds to show (Photo, Video, GIF, No media). `🖼 media` switches inline photos, videos and gifs on (text only by default; a post without text is dimmed then and says what media it holds; resting the mouse a second on the media badge shows a floating preview). 🙈 on a row hides a post that is noise (dimmed, its row gets `hidden = TRUE`, a sync never resets it), 👁 brings it back; 📥 csv and 📥 {} in the toolbar export the filtered rows
- Import JSON (Setup): the file the badge's JSON button downloads on x.com
- Light and dark theme, mobile layout; the config, the current account and a copy of the posts stay in localStorage (every access in try/catch), the Google token only in memory

## Sheet columns

`id, handle, author_name, created_at, type, text, lang, url, in_reply_to_id, in_reply_to_handle, conversation_id, quoted_id, reposted_id, reposted_handle, media, links, likes, reposts, replies, quotes, bookmarks, views, is_pinned, first_seen_at, last_seen_at, hidden`

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
