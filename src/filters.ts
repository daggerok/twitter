/// <reference lib="esnext" />
// Pure helpers of the viewer: feed filters, sorting, CSV export and the JSON import of the userscript.
import { byNewest, isPostType, POST_HEADERS, toRow, type Post, type PostType } from '../shared/post';

export type SortKey = 'date' | 'likes' | 'views' | 'reposts' | 'replies';

export type Filters = {
  handles: string[];          // [] = every account
  types: PostType[];          // [] = every type
  from: string;               // YYYY-MM-DD or ''
  to: string;                 // YYYY-MM-DD or ''
  hasMedia: boolean;
  search: string;             // case-insensitive, every word must be in text, author or handle
  sort: SortKey;
};

export const EMPTY_FILTERS: Filters = { handles: [], types: [], from: '', to: '', hasMedia: false, search: '', sort: 'date' };

export function applyFilters(posts: Post[], f: Filters): Post[] {
  const words = f.search.toLowerCase().split(/\s+/).filter(Boolean);
  const from = f.from ? `${f.from}T00:00:00.000Z` : '';
  const to = f.to ? `${f.to}T23:59:59.999Z` : '';
  const out = posts.filter((p) => {
    if (f.handles.length && !f.handles.includes(p.handle)) return false;
    if (f.types.length && !f.types.includes(p.type)) return false;
    if (from && p.created_at < from) return false;
    if (to && p.created_at > to) return false;
    if (f.hasMedia && !p.media.length) return false;
    if (words.length) {
      const hay = `${p.text}\n${p.author_name}\n@${p.handle}\n${p.links.join(' ')}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  if (f.sort === 'date') return out.sort(byNewest);
  const key = f.sort;
  return out.sort((a, b) => b[key] - a[key] || byNewest(a, b));
}

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
