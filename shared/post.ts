/// <reference lib="esnext" />
// =========================================================================
// Post: the one record both halves of the app share.
// - userscript/ (Tampermonkey on x.com) builds posts from X's GraphQL timeline responses (parse.ts)
// - src/ (the viewer on GitHub Pages) writes them to a Google Sheet tab and shows them
// The sheet row layout (POST_HEADERS, toRow, fromRow) lives here so a column added in one place is
// added in the other. IDs are strings everywhere: X ids exceed the safe integer range of JS.
// =========================================================================

export type PostType = 'post' | 'reply' | 'repost' | 'quote';

export type Media = { type: 'photo' | 'video' | 'gif'; url: string };

export type Post = {
  id: string;
  handle: string;          // author screen name, lowercase, no @
  author_name: string;
  created_at: string;      // ISO 8601 UTC
  type: PostType;
  text: string;            // full text, t.co links expanded
  lang: string;
  url: string;             // https://x.com/<handle>/status/<id>
  in_reply_to_id: string;
  in_reply_to_handle: string;
  conversation_id: string;
  quoted_id: string;
  reposted_id: string;
  reposted_handle: string;
  media: Media[];
  links: string[];         // expanded external urls
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  views: number;
  is_pinned: boolean;
  first_seen_at: string;   // ISO, set once
  last_seen_at: string;    // ISO, every capture
};

export const POST_HEADERS = [
  'id', 'handle', 'author_name', 'created_at', 'type', 'text', 'lang', 'url',
  'in_reply_to_id', 'in_reply_to_handle', 'conversation_id', 'quoted_id', 'reposted_id', 'reposted_handle',
  'media', 'links', 'likes', 'reposts', 'replies', 'quotes', 'bookmarks', 'views',
  'is_pinned', 'first_seen_at', 'last_seen_at',
] as const;

/** Column letter of the last header: A1 ranges of a posts tab are `A:${LAST_COL}`. */
export const LAST_COL = String.fromCharCode(64 + POST_HEADERS.length);

export const POST_TYPES: PostType[] = ['post', 'reply', 'repost', 'quote'];

const CELL_LIMIT = 50_000; // Google Sheets: characters per cell
const TRUNCATED = '…[truncated]';

export function clampCell(s: string): string {
  return s.length > CELL_LIMIT ? s.slice(0, CELL_LIMIT - TRUNCATED.length) + TRUNCATED : s;
}

export function toRow(p: Post): string[] {
  return [
    p.id, p.handle, p.author_name, p.created_at, p.type, clampCell(p.text), p.lang, p.url,
    p.in_reply_to_id, p.in_reply_to_handle, p.conversation_id, p.quoted_id, p.reposted_id, p.reposted_handle,
    clampCell(JSON.stringify(p.media)), clampCell(JSON.stringify(p.links)),
    String(p.likes), String(p.reposts), String(p.replies), String(p.quotes), String(p.bookmarks), String(p.views),
    p.is_pinned ? 'TRUE' : 'FALSE', p.first_seen_at, p.last_seen_at,
  ];
}

function cell(row: unknown[], i: number): string {
  const v = row[i];
  return v === undefined || v === null ? '' : String(v);
}

function num(row: unknown[], i: number): number {
  const n = Number(cell(row, i).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function jsonArray<T>(s: string, guard: (x: unknown) => x is T): T[] {
  try {
    const v: unknown = JSON.parse(s || '[]');
    return Array.isArray(v) ? v.filter(guard) : [];
  } catch {
    return [];
  }
}

const isMedia = (x: unknown): x is Media =>
  typeof x === 'object' && x !== null && typeof (x as Media).url === 'string' && typeof (x as Media).type === 'string';
const isString = (x: unknown): x is string => typeof x === 'string';

export function isPostType(s: string): s is PostType {
  return (POST_TYPES as string[]).includes(s);
}

/** A sheet row back to a Post; `null` when the row has no id (an empty or hand-edited line). */
export function fromRow(row: unknown[]): Post | null {
  const id = cell(row, 0).trim();
  if (!id) return null;
  const type = cell(row, 4);
  const created = cell(row, 3);
  return {
    id,
    handle: cell(row, 1).toLowerCase(),
    author_name: cell(row, 2),
    created_at: created,
    type: isPostType(type) ? type : 'post',
    text: cell(row, 5),
    lang: cell(row, 6),
    url: cell(row, 7) || `https://x.com/${cell(row, 1)}/status/${id}`,
    in_reply_to_id: cell(row, 8),
    in_reply_to_handle: cell(row, 9),
    conversation_id: cell(row, 10),
    quoted_id: cell(row, 11),
    reposted_id: cell(row, 12),
    reposted_handle: cell(row, 13),
    media: jsonArray(cell(row, 14), isMedia),
    links: jsonArray(cell(row, 15), isString),
    likes: num(row, 16),
    reposts: num(row, 17),
    replies: num(row, 18),
    quotes: num(row, 19),
    bookmarks: num(row, 20),
    views: num(row, 21),
    is_pinned: cell(row, 22).toUpperCase() === 'TRUE',
    first_seen_at: cell(row, 23) || created,
    last_seen_at: cell(row, 24) || cell(row, 23) || created,
  };
}

/** Snowflake ids grow with time: compare as numbers of any length (never parse them, they overflow). */
export function compareIds(a: string, b: string): number {
  const x = a.replace(/^0+/, '');
  const y = b.replace(/^0+/, '');
  if (x.length !== y.length) return x.length - y.length;
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Newest first: by created_at, ties (and missing dates) by id. */
export function byNewest(a: Post, b: Post): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return compareIds(b.id, a.id);
}

/**
 * Merge captured posts into the stored list: a known id keeps its first_seen_at and takes the fresh
 * counts, text and last_seen_at; a new id is added. Returns the merged list newest first and the counts.
 */
export function mergePosts(stored: Post[], captured: Post[]): { posts: Post[]; inserted: number; updated: number } {
  const byId = new Map<string, Post>();
  stored.forEach((p) => byId.set(p.id, p));
  let inserted = 0;
  let updated = 0;
  captured.forEach((p) => {
    const old = byId.get(p.id);
    if (old) {
      byId.set(p.id, { ...old, ...p, first_seen_at: old.first_seen_at || p.first_seen_at, is_pinned: p.is_pinned || old.is_pinned });
      updated += 1;
    } else {
      byId.set(p.id, p);
      inserted += 1;
    }
  });
  const posts = Array.from(byId.values()).sort(byNewest);
  return { posts, inserted, updated };
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** X's "Wed Oct 10 20:19:24 +0000 2018" to "2018-10-10T20:19:24.000Z"; an unknown format is returned as is. */
export function isoFromXDate(s: string): string {
  const m = /^\w{3} (\w{3}) (\d{1,2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4}) (\d{4})$/.exec((s || '').trim());
  if (!m) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t).toISOString() : s || '';
  }
  const [, mon, day, time, zone, year] = m;
  const month = MONTHS[mon];
  if (!month) return s;
  const t = Date.parse(`${year}-${month}-${day.padStart(2, '0')}T${time}${zone.slice(0, 3)}:${zone.slice(3)}`);
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
}

/** The handle of a profile url path: `/elonmusk`, `/elonmusk/with_replies`, `/elonmusk/media`; null elsewhere. */
export function handleFromPath(pathname: string): string | null {
  const m = /^\/([A-Za-z0-9_]{1,15})(?:\/(?:with_replies|media|highlights|likes|articles))?\/?$/.exec(pathname);
  if (!m) return null;
  const h = m[1].toLowerCase();
  if (RESERVED.has(h)) return null;
  return h;
}

const RESERVED = new Set([
  'home', 'explore', 'notifications', 'messages', 'i', 'search', 'settings', 'compose', 'login', 'logout',
  'signup', 'tos', 'privacy', 'about', 'jobs', 'hashtag', 'intent', 'share', 'account', 'bookmarks', 'lists',
  'communities', 'premium', 'verified', 'download', 'help', 'who_to_follow', 'connect_people', 'grok',
]);
