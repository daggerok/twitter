/// <reference lib="esnext" />
// Pure helpers of the viewer: the column filters and sorting of the table (the youtube syntax), CSV export, the JSON
// import of the userscript, link splitting.
import { byNewest, isPostType, POST_HEADERS, toRow, type Post } from '../shared/post';

export type ColKey = 'datetime' | 'type' | 'post' | 'stats' | 'hidden';
export const COLS: ColKey[] = ['datetime', 'type', 'post', 'stats', 'hidden'];
export type SortDir = 'asc' | 'desc';
export type MediaKind = 'photo' | 'video' | 'gif' | 'none';
export const MEDIA_KINDS: { key: MediaKind; label: string }[] = [{ key: 'photo', label: '📷 Photo' }, { key: 'video', label: '🎬 Video' }, { key: 'gif', label: 'GIF' }, { key: 'none', label: 'No media (text only)' }];
/** media: the ticked kinds of the dropdown, [] = every post; a post matches when it has one of the ticked kinds (none = no media at all) */
export type TableState = { filters: Record<ColKey, string>; sort: { key: ColKey; dir: SortDir }; media: MediaKind[] };
export const EMPTY_TABLE: TableState = { filters: { datetime: '', type: '', post: '', stats: '', hidden: '' }, sort: { key: 'datetime', dir: 'desc' }, media: [] };

export function matchMedia(p: Post, kinds: MediaKind[]): boolean {
  if (!kinds.length) return true;
  if (!p.media.length) return kinds.includes('none');
  return p.media.some((m) => (kinds as string[]).includes(m.type));
}

const MEDIA_WORD: Record<string, string> = { photo: '📷 photo', video: '🎬 video', gif: 'gif' };

/** What each column's filter sees for a post, lower case (the text a filter is matched against). */
export function columnText(p: Post, col: ColKey, fmtDate: (iso: string) => string): string {
  switch (col) {
    case 'datetime': return fmtDate(p.created_at).toLowerCase();
    case 'type': return [p.type, p.is_pinned ? 'pinned' : '', ...p.media.map((m) => MEDIA_WORD[m.type] || m.type), p.media.length ? 'media' : 'text only'].filter(Boolean).join(' ').toLowerCase();
    case 'post': return [p.text, p.type === 'repost' ? `repost of @${p.reposted_handle}` : '', p.type === 'reply' ? `to @${p.in_reply_to_handle}` : '', p.author_name, `@${p.handle}`, p.links.join(' ')].filter(Boolean).join(' ').toLowerCase();
    case 'stats': return `replies ${p.replies} reposts ${p.reposts} likes ${p.likes} views ${p.views} bookmarks ${p.bookmarks}`;
    case 'hidden': return p.hidden ? 'hidden' : 'visible';
    default: return '';
  }
}

/**
 * The youtube filter syntax, case-insensitive: `a*b` or `a&b` = a then b in order (any text between, no overlap),
 * `a|b` = either, AND binds tighter than OR, spaces are literal, empty operands are ignored, an empty or
 * operators-only query matches everything.
 */
export function matchFilter(text: string, query: string): boolean {
  const q = query.toLowerCase();
  const alternatives = q.split('|').map((alt) => alt.split(/[*&]/).filter((t) => t.length > 0)).filter((terms) => terms.length > 0);
  if (!alternatives.length) return true;
  const hay = text.toLowerCase();
  return alternatives.some((terms) => {
    let from = 0;
    for (const term of terms) {
      const i = hay.indexOf(term, from);
      if (i === -1) return false;
      from = i + term.length;
    }
    return true;
  });
}

const sortValue = (p: Post, key: ColKey, fmtDate: (iso: string) => string): string | number => {
  switch (key) {
    case 'datetime': return p.created_at;
    case 'type': return `${p.type} ${p.is_pinned ? '0' : '1'}`;
    case 'post': return p.text.toLowerCase();
    case 'stats': return p.likes;
    case 'hidden': return p.hidden ? 1 : 0;
    default: return fmtDate(p.created_at);
  }
};

/** Filter every column, then sort (ties by newest). */
export function applyTable(posts: Post[], s: TableState, fmtDate: (iso: string) => string): Post[] {
  const active = COLS.filter((c) => s.filters[c].trim() !== '');
  const out = posts.filter((p) => matchMedia(p, s.media) && active.every((c) => matchFilter(columnText(p, c, fmtDate), s.filters[c])));
  const dir = s.sort.dir === 'asc' ? 1 : -1;
  return out.sort((a, b) => {
    const x = sortValue(a, s.sort.key, fmtDate);
    const y = sortValue(b, s.sort.key, fmtDate);
    if (x < y) return -dir;
    if (x > y) return dir;
    return byNewest(a, b);
  });
}

export const hasFilters = (s: TableState): boolean => s.media.length > 0 || COLS.some((c) => s.filters[c].trim() !== '');

const csvCell = (v: string): string => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(posts: Post[]): string {
  const lines = [Array.from(POST_HEADERS).join(',')];
  posts.forEach((p) => lines.push(toRow(p).map(csvCell).join(',')));
  return lines.join('\r\n') + '\r\n';
}

/** Posts of a JSON file downloaded from the userscript badge (`{ posts: [...] }`) or a bare array. */
export function postsFromJson(text: string): Post[] {
  let v: unknown;
  try { v = JSON.parse(text); } catch { throw new Error('Not a JSON file'); }
  const list = Array.isArray(v) ? v : (v as { posts?: unknown })?.posts;
  if (!Array.isArray(list)) throw new Error('No "posts" array in the file');
  const out: Post[] = [];
  list.forEach((x) => {
    if (typeof x !== 'object' || x === null) return;
    const p = x as Partial<Post>;
    if (typeof p.id !== 'string' || !p.id || typeof p.handle !== 'string') return;
    out.push({
      id: p.id,
      handle: p.handle.toLowerCase(),
      author_name: typeof p.author_name === 'string' ? p.author_name : '',
      created_at: typeof p.created_at === 'string' ? p.created_at : '',
      type: typeof p.type === 'string' && isPostType(p.type) ? p.type : 'post',
      text: typeof p.text === 'string' ? p.text : '',
      lang: typeof p.lang === 'string' ? p.lang : '',
      url: typeof p.url === 'string' && p.url ? p.url : `https://x.com/${p.handle}/status/${p.id}`,
      in_reply_to_id: typeof p.in_reply_to_id === 'string' ? p.in_reply_to_id : '',
      in_reply_to_handle: typeof p.in_reply_to_handle === 'string' ? p.in_reply_to_handle : '',
      conversation_id: typeof p.conversation_id === 'string' ? p.conversation_id : '',
      quoted_id: typeof p.quoted_id === 'string' ? p.quoted_id : '',
      reposted_id: typeof p.reposted_id === 'string' ? p.reposted_id : '',
      reposted_handle: typeof p.reposted_handle === 'string' ? p.reposted_handle : '',
      media: Array.isArray(p.media) ? p.media.filter((m) => m && typeof m.url === 'string') : [],
      links: Array.isArray(p.links) ? p.links.filter((l): l is string => typeof l === 'string') : [],
      likes: Number(p.likes) || 0,
      reposts: Number(p.reposts) || 0,
      replies: Number(p.replies) || 0,
      quotes: Number(p.quotes) || 0,
      bookmarks: Number(p.bookmarks) || 0,
      views: Number(p.views) || 0,
      is_pinned: p.is_pinned === true,
      first_seen_at: typeof p.first_seen_at === 'string' ? p.first_seen_at : new Date().toISOString(),
      last_seen_at: typeof p.last_seen_at === 'string' ? p.last_seen_at : new Date().toISOString(),
      hidden: p.hidden === true,
    });
  });
  return out;
}

/** Text with urls turned into links: returns the parts for rendering (no HTML strings). */
export function linkify(text: string): { kind: 'text' | 'link'; value: string }[] {
  const parts: { kind: 'text' | 'link'; value: string }[] = [];
  const re = /https?:\/\/[^\s<>"')\]]+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
    parts.push({ kind: 'link', value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}

export const formatCount = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
