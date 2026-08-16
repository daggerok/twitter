# X / Twitter Timeline Dashboard

A mobile-first, browser-only timeline tracker for X accounts, styled and structured like [`daggerok/youtube`](https://github.com/daggerok/youtube).

Live app: <https://daggerok.github.io/twitter/>

## Features

- Defaults to [`@I_Am_The_ICT`](https://x.com/I_Am_The_ICT)
- Classifies new posts, self-thread follow-ups, replies to other accounts, reposts, and quote posts
- Stores cached posts, statuses, filters, and notes in browser `localStorage`
- Optionally syncs data to Google Sheets using one `TW-@handle` tab per account
- Supports CSV export and manual twitterapi.io JSON import
- Remains a single-file application in [`index.html`](./index.html)

## Setup

Open **⚙️ Settings** in the app. It contains two complete, collapsible guides:

1. **📋 twitterapi.io Setup (API key & pricing)**
2. **📋 Google Sheets Setup (per-channel tabs)**

### Is twitterapi.io free?

twitterapi.io is **free to start, not free forever**. Its site currently advertises a one-time **$0.10 starter credit** with no credit card required. After that, usage is pay-as-you-go; verify current rates at <https://twitterapi.io/pricing>.

The static dashboard and optional Google Sheets integration have no app subscription cost. Reliable ongoing reads of another account's X timeline do not currently have an unlimited free API option. The dashboard minimizes API usage by caching profile metadata and tweets, and by stopping Update pagination after a known post.

## Privacy

This is a personal static app. API credentials and configuration are stored only in your browser's `localStorage`; the Google access token is held in memory. Do not publish or share your twitterapi.io key.
