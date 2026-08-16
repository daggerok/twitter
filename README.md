# X / Twitter Timeline Dashboard

A mobile-first, browser-only viewer for public X timelines, styled and structured like [`daggerok/youtube`](https://github.com/daggerok/youtube).

Live app: <https://daggerok.github.io/twitter/>

## 100% free official mode

The app now uses X's official embedded-profile widget:

- no twitterapi.io account or key
- no official X developer account or Bearer Token
- no CORS proxy, Cloudflare Worker, or other server
- no purchased API credit
- defaults to [`@I_Am_The_ICT`](https://x.com/I_Am_The_ICT/with_replies)
- requests replies through the official widget configuration
- remembers the selected handle and theme in browser `localStorage`
- remains a single-file application in [`index.html`](./index.html)

## Important limitations

The official widget renders its timeline inside a cross-origin iframe. Browsers intentionally prevent this application from reading the iframe's post data. Consequently, the free version cannot:

- classify individual posts as new posts, thread follow-ups, or replies
- cache individual posts in `localStorage`
- filter, annotate, or export post records
- synchronize tweet rows to Google Sheets

X controls the ordering, availability, and number of posts rendered by the widget. Use the **↗** toolbar action to open the complete Posts & replies page on X.

Structured tracking would require a data API and a server-side proxy. The official X API currently uses pay-per-use pricing, while third-party APIs are metered after their trial credit. Those integrations are deliberately omitted from this free-only build.

## References

- [X: How to embed a timeline](https://help.twitter.com/en/using-twitter/embed-twitter-feed)
- [X API pay-per-usage pricing](https://docs.x.com/x-api/getting-started/pricing)
