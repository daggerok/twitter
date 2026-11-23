/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { byNewest, compareIds, dateFromId, findTab, newestIds, tabOfPath, firstRowOfRange, fromRow, handleFromPath, handleOfTab, isCredsFresh, isoFromXDate, LAST_COL, mergePosts, POST_HEADERS, quoteTab, rangeOf, sameHandle, tabOf, toRow, type Post } from './post';

export const samplePost = (over: Partial<Post> = {}): Post => ({
  id: '1700000000000000001',
  handle: 'someone',
  author_name: 'Some One',
  created_at: '2026-10-01T10:00:00.000Z',
  type: 'post',
  text: 'hello',
  lang: 'en',
  url: 'https://x.com/someone/status/1700000000000000001',
  in_reply_to_id: '',
  in_reply_to_handle: '',
  in_reply_to_text: '',
  conversation_id: '1700000000000000001',
  quoted_id: '',
  reposted_id: '',
  reposted_handle: '',
  media: [],
  links: [],
  likes: 1,
  reposts: 2,
  replies: 3,
  quotes: 4,
  bookmarks: 5,
  views: 6,
  is_pinned: false,
  first_seen_at: '2026-10-02T00:00:00.000Z',
  last_seen_at: '2026-10-02T00:00:00.000Z',
  hidden: false,
  ...over,
});

describe('sheet rows', () => {
  test('27 columns, A..AA', () => {
    expect(POST_HEADERS.length).toBe(27);
    expect(LAST_COL).toBe('AA');
    expect(toRow(samplePost()).length).toBe(POST_HEADERS.length);
  });

  test('toRow -> fromRow round trip keeps every field, ids stay strings', () => {
    const p = samplePost({ media: [{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' }], links: ['https://ex.com'], is_pinned: true });
    const back = fromRow(toRow(p));
    expect(back).toEqual(p);
    expect(typeof back?.id).toBe('string');
  });

  test('a row without id is skipped, numbers written by hand still read', () => {
    expect(fromRow([])).toBeNull();
    expect(fromRow(['', 'x'])).toBeNull();
    const row = toRow(samplePost()) as unknown[];
    row[16] = 12; // a number cell
    row[22] = true; // a boolean cell
    const p = fromRow(row);
    expect(p?.likes).toBe(12);
    expect(p?.is_pinned).toBe(true);
  });

  test('a cell longer than 50000 chars is truncated with a marker', () => {
    const row = toRow(samplePost({ text: 'x'.repeat(60_000) }));
    expect(row[5].length).toBe(50_000);
    expect(row[5].endsWith('…[truncated]')).toBe(true);
  });
});

describe('ids and order', () => {
  test('compareIds works past 2^53 and across lengths', () => {
    expect(compareIds('1700000000000000001', '1700000000000000002')).toBeLessThan(0);
    expect(compareIds('9007199254740993', '9007199254740992')).toBeGreaterThan(0);
    expect(compareIds('99', '100')).toBeLessThan(0);
    expect(compareIds('0100', '100')).toBe(0);
  });

  test('byNewest sorts by date then id', () => {
    const a = samplePost({ id: '2', created_at: '2026-01-01T00:00:00.000Z' });
    const b = samplePost({ id: '3', created_at: '2026-01-02T00:00:00.000Z' });
    const c = samplePost({ id: '1', created_at: '2026-01-02T00:00:00.000Z' });
    expect([a, b, c].sort(byNewest).map((p) => p.id)).toEqual(['3', '1', '2']);
  });

  test('mergePosts keeps first_seen_at, takes fresh counts, never duplicates', () => {
    const stored = [samplePost({ likes: 1, first_seen_at: '2026-09-01T00:00:00.000Z', last_seen_at: '2026-09-01T00:00:00.000Z' })];
    const captured = [
      samplePost({ likes: 9, first_seen_at: '2026-10-05T00:00:00.000Z', last_seen_at: '2026-10-05T00:00:00.000Z' }),
      samplePost({ id: '1700000000000000009', created_at: '2026-10-03T00:00:00.000Z' }),
    ];
    const r = mergePosts(stored, captured);
    expect(r.inserted).toBe(1);
    expect(r.updated).toBe(1);
    expect(r.posts.length).toBe(2);
    expect(r.posts[0].id).toBe('1700000000000000009');
    expect(r.posts[1].likes).toBe(9);
    expect(r.posts[1].first_seen_at).toBe('2026-09-01T00:00:00.000Z');
    expect(r.posts[1].last_seen_at).toBe('2026-10-05T00:00:00.000Z');
    expect(mergePosts(r.posts, captured).inserted).toBe(0);
  });

  test('mergePosts keeps the owner hidden flag over a fresh capture', () => {
    expect(mergePosts([samplePost({ hidden: true })], [samplePost({ hidden: false, likes: 7 })]).posts[0]).toMatchObject({ hidden: true, likes: 7 });
    expect(mergePosts([], [samplePost({ hidden: true })]).posts[0].hidden).toBe(true);
  });
});

describe('x dates and profile paths', () => {
  test('isoFromXDate converts the legacy format and leaves ISO alone', () => {
    expect(isoFromXDate('Wed Oct 10 20:19:24 +0000 2018')).toBe('2018-10-10T20:19:24.000Z');
    expect(isoFromXDate('Tue Jan 07 09:00:00 +0200 2025')).toBe('2025-01-07T07:00:00.000Z');
    expect(isoFromXDate('2026-10-01T10:00:00.000Z')).toBe('2026-10-01T10:00:00.000Z');
    expect(isoFromXDate('')).toBe('');
  });

  test('handleFromPath keeps the case, accepts profile tabs and rejects app pages', () => {
    expect(handleFromPath('/ElonMusk')).toBe('ElonMusk');
    expect(handleFromPath('/elonmusk/with_replies')).toBe('elonmusk');
    expect(handleFromPath('/Home')).toBeNull();
    expect(sameHandle('I_Am_The_ICT', 'i_am_the_ict')).toBe(true);
    expect(handleFromPath('/elonmusk/media/')).toBe('elonmusk');
    expect(handleFromPath('/home')).toBeNull();
    expect(handleFromPath('/i/flow/login')).toBeNull();
    expect(handleFromPath('/elonmusk/status/123')).toBeNull();
    expect(handleFromPath('/search')).toBeNull();
  });
});

describe('sheet tab helpers', () => {
  test('tabOf, handleOfTab, quoteTab, rangeOf', () => {
    expect(tabOf('Elon_Musk')).toBe('X-Elon_Musk');
    expect(findTab(['YT-x', 'X-i_am_the_ict'], 'X-I_Am_The_ICT')).toBe('X-i_am_the_ict');
    expect(findTab(['YT-x'], 'X-abc')).toBeUndefined();
    expect(handleOfTab('X-abc')).toBe('abc');
    expect(handleOfTab('YT-abc')).toBeNull();
    expect(quoteTab('X-abc')).toBe("'X-abc'");
    expect(quoteTab('Xabc')).toBe('Xabc');
    expect(decodeURIComponent(rangeOf('X-abc', 'A2:Z'))).toBe("'X-abc'!A2:Z");
  });
  test('firstRowOfRange reads the append answer', () => {
    expect(firstRowOfRange("'X-abc'!A1400:Y1402")).toBe(1400);
    expect(firstRowOfRange('Xabc!A2:Y2')).toBe(2);
    expect(firstRowOfRange('')).toBe(0);
  });
  test('isCredsFresh needs token, spreadsheet and more than a minute left', () => {
    const now = 1_000_000;
    expect(isCredsFresh({ token: 't', spreadsheetId: 's', expiresAt: now + 120_000, email: '' }, now)).toBe(true);
    expect(isCredsFresh({ token: 't', spreadsheetId: 's', expiresAt: now + 30_000, email: '' }, now)).toBe(false);
    expect(isCredsFresh({ token: '', spreadsheetId: 's', expiresAt: now + 120_000, email: '' }, now)).toBe(false);
    expect(isCredsFresh(null, now)).toBe(false);
  });
});

describe('the November 2026 fixes', () => {
  test('dateFromId reads the time a snowflake id carries, a non-snowflake gives nothing', () => {
    const at = Date.parse('2026-11-20T15:00:00.123Z');
    const id = (BigInt(at - 1288834974657) * BigInt(4194304) + BigInt(12345)).toString();
    expect(dateFromId(id)).toBe('2026-11-20T15:00:00.123Z');
    expect(dateFromId('12')).toBe('');
    expect(dateFromId('abc')).toBe('');
  });

  test('a row without a date gets it from the id', () => {
    const at = Date.parse('2026-11-20T15:00:00.000Z');
    const id = (BigInt(at - 1288834974657) * BigInt(4194304)).toString();
    const row = toRow(samplePost({ id, created_at: '' })) as unknown[];
    expect(fromRow(row)?.created_at).toBe('2026-11-20T15:00:00.000Z');
  });

  test('a poorer capture never blanks what the sheet has: empty text, 0 views and no media keep the stored ones', () => {
    const stored = samplePost({ text: 'full text', views: 500, lang: 'en', media: [{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' }], likes: 10, hidden: true });
    const poor = samplePost({ text: '', views: 0, lang: '', media: [], likes: 12, hidden: false });
    const m = mergePosts([stored], [poor]).posts[0];
    expect([m.text, m.views, m.lang, m.media.length, m.likes, m.hidden]).toEqual(['full text', 500, 'en', 1, 12, true]);
    expect(mergePosts([samplePost({ type: 'reply' })], [samplePost({ type: 'post' })]).posts[0].type).toBe('reply');
    expect(mergePosts([samplePost({ type: 'post' })], [samplePost({ type: 'quote' })]).posts[0].type).toBe('quote');
  });

  test('the reposts tab is a profile page', () => {
    expect(handleFromPath('/I_Am_Someone/reposts')).toBe('I_Am_Someone');
  });
});

describe('incremental runs per profile tab', () => {
  test('tabOfPath: Posts, Replies, Reposts, the rest is all', () => {
    expect(['/Acc', '/Acc/', '/Acc/with_replies', '/Acc/reposts', '/Acc/media', '/home/x/y'].map(tabOfPath)).toEqual(['posts', 'posts', 'replies', 'reposts', 'all', 'all']);
  });

  test('newestIds: per kind, complete unpinned rows only (an empty row of the broken run is passed)', () => {
    const rows = [
      samplePost({ id: '100', type: 'post', text: 'a' }),
      samplePost({ id: '300', type: 'post', text: '', media: [] }),            // the broken run: no text, no media
      samplePost({ id: '250', type: 'quote', text: 'q' }),
      samplePost({ id: '200', type: 'reply', text: 'r' }),
      samplePost({ id: '400', type: 'post', text: 'pinned', is_pinned: true }),
      samplePost({ id: '150', type: 'repost', text: '', media: [{ type: 'photo', url: 'https://pbs.twimg.com/m.jpg' }] }),
    ];
    const now = Date.parse('2026-11-23T12:00:00.000Z');
    const fresh = '2026-11-23T10:00:00.000Z';
    // the empty row 300 is a hole; every complete row here is below it, so the per-kind newest ids stay as they are
    expect(newestIds(rows.map((p) => ({ ...p, first_seen_at: fresh })), now)).toEqual({ posts: '250', replies: '200', reposts: '150', all: '250' });
    expect(newestIds([])).toEqual({ posts: '', replies: '', reposts: '', all: '' });
  });
});

describe('the frontier sits below every recent empty row', () => {
  const now = Date.parse('2026-11-23T12:00:00.000Z');
  const seen = '2026-11-23T10:00:00.000Z';
  test('complete rows filled above a hole do not stop the next run: it goes below the oldest hole', () => {
    const rows = [
      samplePost({ id: '900', type: 'reply', text: 'filled by the last run', first_seen_at: seen }),
      samplePost({ id: '800', type: 'post', text: '', created_at: '2026-11-20T10:00:00.000Z', first_seen_at: seen }),   // still empty
      samplePost({ id: '700', type: 'reply', text: 'older reply', first_seen_at: seen }),
      samplePost({ id: '600', type: 'post', text: '', created_at: '2026-11-01T15:28:00.000Z', first_seen_at: seen }),   // a stored row the broken run blanked
      samplePost({ id: '500', type: 'reply', text: 'before the holes', first_seen_at: seen }),
      samplePost({ id: '400', type: 'post', text: 'a post', first_seen_at: seen }),
    ];
    expect(newestIds(rows, now)).toEqual({ posts: '400', replies: '500', reposts: '', all: '500' });
  });
  test('an empty row of a post made more than HOLE_DAYS ago never holds the frontier, even when first seen today', () => {
    const rows = [
      samplePost({ id: '900', type: 'reply', text: 'r', first_seen_at: seen }),
      samplePost({ id: '800', type: 'post', text: '', created_at: '2024-05-01T00:00:00.000Z', first_seen_at: seen }),
    ];
    expect(newestIds(rows, now).replies).toBe('900');
  });
});
