/// <reference lib="esnext" />
// =========================================================================
// X GraphQL timeline -> Post[]. Pure, never throws on one bad entry (it is skipped and counted).
// Walks data.user.result.timeline_v2.timeline.instructions[] of UserTweets, UserTweetsAndReplies and
// UserMedia (TweetDetail has the same entries under data.threaded_conversation_with_injections_v2).
// Query ids are not used anywhere: the interceptor matches the operation name in the url.
// =========================================================================
import { isoFromXDate, type Media, type Post, type PostType } from '../../shared/post';

type Obj = Record<string, unknown>;

export type ParseResult = {
  posts: Post[];
  skipped: number;            // entries that were not tweets of the handle (ads, other authors, tombstones)
  errors: number;             // entries that threw while being read
  cursorBottom: string | null;
  account: AccountInfo | null;
};

export type AccountInfo = { handle: string; display_handle: string; user_id: string; display_name: string; followers: number };

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const int = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const get = (v: unknown, ...path: string[]): unknown => {
  let cur: unknown = v;
  for (const k of path) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Instructions of any X timeline payload (user timelines first, then a tweet detail page). */
export function instructionsOf(json: unknown): unknown[] {
  const candidates = [
    get(json, 'data', 'user', 'result', 'timeline_v2', 'timeline', 'instructions'),
    get(json, 'data', 'user', 'result', 'timeline', 'timeline', 'instructions'),
    // the 2026 operations (UserRepliesTimeline, UserTweetsTimeline, ...) answer under user_result / timeline_response
    get(json, 'data', 'user_result', 'result', 'timeline_response', 'timeline', 'instructions'),
    get(json, 'data', 'user', 'result', 'timeline_response', 'timeline', 'instructions'),
    get(json, 'data', 'threaded_conversation_with_injections_v2', 'instructions'),
    get(json, 'data', 'timeline_response', 'instructions'),
  ];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

/** Every tweet result object of a payload, with the pinned flag; cursor entries are skipped. */
function tweetResults(json: unknown): { result: unknown; pinned: boolean; promoted: boolean }[] {
  const out: { result: unknown; pinned: boolean; promoted: boolean }[] = [];
  // two spellings: the classic one (type, entryType, itemContent, itemType) and the newer one, where every object
  // carries __typename and the item content sits under `content`
  const pushItem = (itemContent: unknown, pinned: boolean) => {
    if (!isObj(itemContent)) return;
    const itemType = itemContent.itemType || itemContent.__typename;
    if (itemType && itemType !== 'TimelineTweet') return;
    const result = get(itemContent, 'tweet_results', 'result');
    if (result === undefined) return;
    out.push({ result, pinned, promoted: isObj(itemContent.promotedMetadata) });
  };
  const itemOf = (it: unknown): unknown => get(it, 'item', 'itemContent') ?? get(it, 'item', 'content') ?? get(it, 'content');
  const pushEntry = (entry: unknown, pinned: boolean) => {
    const content = get(entry, 'content');
    if (!isObj(content)) return;
    const entryType = content.entryType || content.__typename;
    if (entryType === 'TimelineTimelineItem') pushItem(content.itemContent ?? content.content, pinned);
    else if (entryType === 'TimelineTimelineModule') {
      arr(content.items).forEach((it) => pushItem(itemOf(it), pinned));
    }
  };
  instructionsOf(json).forEach((ins) => {
    const type = get(ins, 'type') || get(ins, '__typename');
    if (type === 'TimelinePinEntry') pushEntry(get(ins, 'entry'), true);
    else if (type === 'TimelineAddEntries') arr(get(ins, 'entries')).forEach((e) => pushEntry(e, false));
    else if (type === 'TimelineAddToModule') arr(get(ins, 'moduleItems')).forEach((it) => pushItem(itemOf(it), false));
  });
  return out;
}

export function bottomCursor(json: unknown): string | null {
  let cursor: string | null = null;
  instructionsOf(json).forEach((ins) => {
    if ((get(ins, 'type') || get(ins, '__typename')) !== 'TimelineAddEntries') return;
    arr(get(ins, 'entries')).forEach((e) => {
      const c = get(e, 'content');
      if (isObj(c) && (c.entryType || c.__typename) === 'TimelineTimelineCursor' && c.cursorType === 'Bottom') cursor = str(c.value) || null;
    });
  });
  return cursor;
}

/** `TweetWithVisibilityResults` wraps the tweet; tombstones and unavailable tweets give null. */
export function unwrapTweet(result: unknown): Obj | null {
  if (!isObj(result)) return null;
  const tn = result.__typename;
  if (tn === 'TweetWithVisibilityResults') return isObj(result.tweet) ? result.tweet : null;
  if (tn === 'TweetTombstone' || tn === 'TweetUnavailable') return null;
  if (!result.rest_id && !result.legacy) return null;
  return result;
}

type UserInfo = { handle: string; screen: string; name: string; id: string; followers: number };

export function userOf(tweet: Obj): UserInfo {
  const u = get(tweet, 'core', 'user_results', 'result');
  // 2025 schema moved name and screen_name from legacy to core; read both
  const handle = str(get(u, 'core', 'screen_name')) || str(get(u, 'legacy', 'screen_name'));
  const name = str(get(u, 'core', 'name')) || str(get(u, 'legacy', 'name'));
  return {
    handle,
    screen: handle,
    name,
    id: str(get(u, 'rest_id')),
    followers: int(get(u, 'legacy', 'followers_count')),
  };
}

function expandUrls(text: string, urls: unknown[]): { text: string; links: string[] } {
  const links: string[] = [];
  let out = text;
  urls.forEach((u) => {
    const short = str(get(u, 'url'));
    const full = str(get(u, 'expanded_url'));
    if (!short || !full) return;
    out = out.split(short).join(full);
    // a quoted post link is in quoted_id already, not an external link
    if (!/^https?:\/\/(x|twitter)\.com\/[^/]+\/status\//i.test(full)) links.push(full);
  });
  return { text: out, links };
}

function mediaOf(tweet: Obj): { media: Media[]; mediaUrls: string[] } {
  const items = arr(get(tweet, 'legacy', 'extended_entities', 'media'));
  const media: Media[] = [];
  const mediaUrls: string[] = [];
  items.forEach((m) => {
    const type = str(get(m, 'type'));
    const shortUrl = str(get(m, 'url'));
    if (shortUrl) mediaUrls.push(shortUrl);
    if (type === 'photo') {
      const url = str(get(m, 'media_url_https'));
      if (url) media.push({ type: 'photo', url });
    } else if (type === 'video' || type === 'animated_gif') {
      let best = '';
      let bestRate = -1;
      arr(get(m, 'video_info', 'variants')).forEach((v) => {
        if (str(get(v, 'content_type')) !== 'video/mp4') return;
        const rate = int(get(v, 'bitrate'));
        if (rate > bestRate) { bestRate = rate; best = str(get(v, 'url')); }
      });
      const url = best || str(get(m, 'media_url_https'));
      if (url) media.push({ type: type === 'video' ? 'video' : 'gif', url });
    }
  });
  return { media, mediaUrls };
}

function textOf(tweet: Obj): { text: string; links: string[] } {
  const note = get(tweet, 'note_tweet', 'note_tweet_results', 'result');
  const legacy = get(tweet, 'legacy');
  const noteText = str(get(note, 'text'));
  const raw = noteText || str(get(legacy, 'full_text'));
  const urls = noteText ? arr(get(note, 'entity_set', 'urls')) : arr(get(legacy, 'entities', 'urls'));
  const { text, links } = expandUrls(raw, urls);
  const { mediaUrls } = mediaOf(tweet);
  // X appends the t.co of attached media to the text; drop it, the media column has the real urls
  let clean = text;
  mediaUrls.forEach((u) => { clean = clean.split(u).join(''); });
  return { text: clean.trim(), links: links.filter((l) => !mediaUrls.includes(l)) };
}

export function classify(tweet: Obj): PostType {
  const legacy = get(tweet, 'legacy');
  if (isObj(get(legacy, 'retweeted_status_result', 'result'))) return 'repost';
  if (str(get(legacy, 'in_reply_to_status_id_str'))) return 'reply';
  if (get(legacy, 'is_quote_status') === true || isObj(get(tweet, 'quoted_status_result', 'result'))) return 'quote';
  return 'post';
}

/** One tweet result object to a Post, or null when it is not a tweet. */
export function postOf(result: unknown, pinned: boolean, seenAt: string): Post | null {
  const tweet = unwrapTweet(result);
  if (!tweet) return null;
  const id = str(tweet.rest_id) || str(get(tweet, 'legacy', 'id_str'));
  if (!id) return null;
  const legacy = get(tweet, 'legacy');
  const user = userOf(tweet);
  const type = classify(tweet);
  let text: { text: string; links: string[] };
  let reposted_id = '';
  let reposted_handle = '';
  if (type === 'repost') {
    // a repost's own text is "RT @x: ..." cut at 140 chars: take the original tweet's text instead
    const orig = unwrapTweet(get(legacy, 'retweeted_status_result', 'result'));
    reposted_id = orig ? str(orig.rest_id) : '';
    reposted_handle = orig ? userOf(orig).handle : '';
    text = orig ? textOf(orig) : textOf(tweet);
  } else {
    text = textOf(tweet);
  }
  const quoted = unwrapTweet(get(tweet, 'quoted_status_result', 'result'));
  const quoted_id = (quoted ? str(quoted.rest_id) : '') || str(get(legacy, 'quoted_status_id_str'));
  if (quoted_id) {
    // X keeps the link of the quoted post at the end of the text; the UI shows the quote card instead
    text.text = text.text.replace(new RegExp(`\\s*https?:\\/\\/(x|twitter)\\.com\\/[^\\/\\s]+\\/status\\/${quoted_id}(\\?\\S*)?\\s*$`, 'i'), '').trim();
  }
  const { media } = type === 'repost' ? mediaOf(unwrapTweet(get(legacy, 'retweeted_status_result', 'result')) || tweet) : mediaOf(tweet);
  return {
    id,
    handle: user.handle,
    author_name: user.name,
    created_at: isoFromXDate(str(get(legacy, 'created_at'))),
    type,
    text: text.text,
    lang: str(get(legacy, 'lang')),
    url: `https://x.com/${user.handle || 'i'}/status/${id}`,
    in_reply_to_id: str(get(legacy, 'in_reply_to_status_id_str')),
    in_reply_to_handle: str(get(legacy, 'in_reply_to_screen_name')),
    in_reply_to_text: '',
    conversation_id: str(get(legacy, 'conversation_id_str')),
    quoted_id,
    reposted_id,
    reposted_handle,
    media,
    links: text.links,
    likes: int(get(legacy, 'favorite_count')),
    reposts: int(get(legacy, 'retweet_count')),
    replies: int(get(legacy, 'reply_count')),
    quotes: int(get(legacy, 'quote_count')),
    bookmarks: int(get(legacy, 'bookmark_count')),
    views: int(get(tweet, 'views', 'count')),
    is_pinned: pinned,
    first_seen_at: seenAt,
    last_seen_at: seenAt,
    hidden: false,
  };
}

/**
 * Parse a timeline payload. `handle` keeps only the posts of that account (its own posts, replies,
 * quotes and its reposts of others); an empty handle keeps every tweet found.
 */
export function parseTimeline(json: unknown, handle: string, seenAt = new Date().toISOString()): ParseResult {
  const want = handle.toLowerCase().replace(/^@/, '');
  const posts: Post[] = [];
  const ids = new Set<string>();
  const seen = new Map<string, Post>(); // every tweet of the payload, other authors too: the parents of the replies
  let skipped = 0;
  let errors = 0;
  let account: AccountInfo | null = null;
  tweetResults(json).forEach(({ result, pinned, promoted }) => {
    try {
      if (promoted) { skipped += 1; return; }
      const p = postOf(result, pinned, seenAt);
      if (p && !seen.has(p.id)) seen.set(p.id, p);
      if (!p || (want && p.handle.toLowerCase() !== want) || ids.has(p.id)) { skipped += 1; return; }
      ids.add(p.id);
      posts.push(p);
      if (!account && p.handle) {
        const t = unwrapTweet(result);
        const u = t ? userOf(t) : null;
        if (u && u.id) account = { handle: u.handle, display_handle: u.screen, user_id: u.id, display_name: u.name, followers: u.followers };
      }
    } catch {
      errors += 1;
    }
  });
  // a reply shown with its conversation: keep what the other person wrote (the owner reads the account's answer in context)
  posts.forEach((p) => {
    if (p.type !== 'reply' || !p.in_reply_to_id) return;
    const parent = seen.get(p.in_reply_to_id);
    if (parent && parent.handle.toLowerCase() !== p.handle.toLowerCase()) p.in_reply_to_text = parent.text;
  });
  return { posts, skipped, errors, cursorBottom: bottomCursor(json), account };
}

/** `UserByScreenName` response -> account info (followers, display name, id). */
export function parseUser(json: unknown): AccountInfo | null {
  const u = get(json, 'data', 'user', 'result');
  if (!isObj(u)) return null;
  const screen = str(get(u, 'core', 'screen_name')) || str(get(u, 'legacy', 'screen_name'));
  if (!screen) return null;
  return {
    handle: screen,
    display_handle: screen,
    user_id: str(u.rest_id),
    display_name: str(get(u, 'core', 'name')) || str(get(u, 'legacy', 'name')),
    followers: int(get(u, 'legacy', 'followers_count')),
  };
}

/** Operation name of an X GraphQL url (`/i/api/graphql/<queryId>/UserTweets?...`), or null. */
export function graphqlOperation(url: string): string | null {
  const m = /\/i\/api\/graphql\/[^/]+\/([A-Za-z0-9_]+)/.exec(url);
  return m ? m[1] : null;
}

export const TIMELINE_OPERATIONS = new Set(['UserTweets', 'UserTweetsAndReplies', 'UserMedia', 'TweetDetail']);

/**
 * Is this GraphQL operation a timeline of posts? The classic names, and the 2026 ones that end in `Timeline`
 * (`UserRepliesTimeline`, `UserTweetsTimeline`, `UserMediaTimeline`, ...). Side queries never match.
 */
export const TIMELINE_OPERATION_RE = /^(UserTweets|UserTweetsAndReplies|UserMedia|TweetDetail|User\w*Timeline)$/;
export const isTimelineOperation = (op: string): boolean => TIMELINE_OPERATION_RE.test(op);
