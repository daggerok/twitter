/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { samplePost } from '../shared/post.test';
import { applyTable, columnText, EMPTY_TABLE, formatCount, hasFilters, linkify, matchFilter, postsFromJson, toCsv } from './filters';

const fmt = (iso: string) => iso.slice(0, 16).replace('T', ', ');
const posts = [
  samplePost({ id: '3', handle: 'a', text: 'Hello world', created_at: '2026-03-01T00:00:00.000Z', likes: 5, type: 'post' }),
  samplePost({ id: '2', handle: 'b', text: 'Reply to you', created_at: '2026-02-01T00:00:00.000Z', likes: 50, type: 'reply', in_reply_to_handle: 'someone', media: [{ type: 'photo', url: 'u' }] }),
  samplePost({ id: '1', handle: 'a', text: 'old quote', created_at: '2026-01-01T00:00:00.000Z', likes: 500, views: 9, type: 'quote', hidden: true }),
];
const withFilter = (col: keyof typeof EMPTY_TABLE.filters, q: string) => ({ ...EMPTY_TABLE, filters: { ...EMPTY_TABLE.filters, [col]: q } });

describe('matchFilter (the youtube syntax)', () => {
  test('and in order, or, precedence, literal spaces, empty operands', () => {
    expect(matchFilter('2022 ICT Mentorship Live', '2022*Mentorship')).toBe(true);
    expect(matchFilter('2022 ICT Mentorship Live', 'Mentorship*2022')).toBe(false);
    expect(matchFilter('2022 ICT Mentorship Live', '2022&mentorship&live')).toBe(true);
    expect(matchFilter('2016 Mentorship', '2022 Mentorship|2016 Mentorship')).toBe(true);
    expect(matchFilter('2022 Mentorship Live', '2022*Mentorship&Live|2016*Mentorship')).toBe(true);
    expect(matchFilter('aaa', 'a*a*a*a')).toBe(false);
    expect(matchFilter('anything', '')).toBe(true);
    expect(matchFilter('anything', '|*&')).toBe(true);
    expect(matchFilter('anything', ' ')).toBe(false);
  });
});

describe('applyTable', () => {
  test('default: newest first, hidden rows included', () => {
    expect(applyTable(posts, EMPTY_TABLE, fmt).map((p) => p.id)).toEqual(['3', '2', '1']);
  });
  test('column filters: type, media words, post text, hidden, datetime', () => {
    expect(applyTable(posts, withFilter('type', 'reply|quote'), fmt).map((p) => p.id)).toEqual(['2', '1']);
    expect(applyTable(posts, withFilter('type', 'photo'), fmt).map((p) => p.id)).toEqual(['2']);
    expect(applyTable(posts, withFilter('type', 'text only'), fmt).map((p) => p.id)).toEqual(['3', '1']);
    expect(applyTable(posts, withFilter('post', 'hello*world'), fmt).map((p) => p.id)).toEqual(['3']);
    expect(applyTable(posts, withFilter('post', '@someone'), fmt).map((p) => p.id)).toEqual(['2']);
    expect(applyTable(posts, withFilter('hidden', 'hidden'), fmt).map((p) => p.id)).toEqual(['1']);
    expect(applyTable(posts, withFilter('hidden', 'visible'), fmt).map((p) => p.id)).toEqual(['3', '2']);
    expect(applyTable(posts, withFilter('datetime', '2026-02'), fmt).map((p) => p.id)).toEqual(['2']);
  });
  test('media dropdown: ticked kinds, none = text only, any mix', () => {
    const list = [...posts, samplePost({ id: '4', media: [{ type: 'video', url: 'v' }, { type: 'gif', url: 'g' }] })];
    expect(applyTable(list, { ...EMPTY_TABLE, media: ['photo'] }, fmt).map((p) => p.id)).toEqual(['2']);
    expect(applyTable(list, { ...EMPTY_TABLE, media: ['video'] }, fmt).map((p) => p.id)).toEqual(['4']);
    expect(applyTable(list, { ...EMPTY_TABLE, media: ['none'] }, fmt).map((p) => p.id)).toEqual(['3', '1']);
    expect(applyTable(list, { ...EMPTY_TABLE, media: ['photo', 'gif'] }, fmt).map((p) => p.id)).toEqual(['4', '2']);
    expect(hasFilters({ ...EMPTY_TABLE, media: ['gif'] })).toBe(true);
  });
  test('sorting by column and direction', () => {
    expect(applyTable(posts, { ...EMPTY_TABLE, sort: { key: 'datetime', dir: 'asc' } }, fmt).map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(applyTable(posts, { ...EMPTY_TABLE, sort: { key: 'stats', dir: 'desc' } }, fmt).map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(applyTable(posts, { ...EMPTY_TABLE, sort: { key: 'type', dir: 'asc' } }, fmt).map((p) => p.id)).toEqual(['3', '1', '2']);
    expect(hasFilters(EMPTY_TABLE)).toBe(false);
    expect(hasFilters(withFilter('post', 'x'))).toBe(true);
  });
  test('columnText of the type column names pinned and the media', () => {
    expect(columnText(samplePost({ is_pinned: true, media: [{ type: 'video', url: 'v' }, { type: 'gif', url: 'g' }] }), 'type', fmt)).toBe('post pinned 🎬 video gif media');
  });
});

describe('csv, json import, linkify', () => {
  test('csv quotes commas, quotes and new lines', () => {
    const csv = toCsv([samplePost({ text: 'a,"b"\nc' })]);
    const lines = csv.split('\r\n');
    expect(lines[0].startsWith('id,handle,author_name')).toBe(true);
    expect(lines[1]).toContain('"a,""b""\nc"');
  });
  test('postsFromJson accepts the badge file and a bare array, skips junk', () => {
    const file = JSON.stringify({ version: '2.0.0', posts: [samplePost(), { id: 5 }, null, { id: 'x', handle: 'H', likes: '3' }] });
    const got = postsFromJson(file);
    expect(got.length).toBe(2);
    expect(got[0]).toEqual(samplePost());
    expect(got[1].handle).toBe('h');
    expect(got[1].likes).toBe(3);
    expect(got[1].url).toBe('https://x.com/H/status/x');
    expect(postsFromJson('[]')).toEqual([]);
    expect(() => postsFromJson('nope')).toThrow('Not a JSON file');
    expect(() => postsFromJson('{"a":1}')).toThrow('No "posts" array');
  });
  test('linkify splits urls out of text', () => {
    expect(linkify('see https://a.b/c. ok')).toEqual([
      { kind: 'text', value: 'see ' }, { kind: 'link', value: 'https://a.b/c.' }, { kind: 'text', value: ' ok' },
    ]);
    expect(linkify('plain')).toEqual([{ kind: 'text', value: 'plain' }]);
    expect(linkify('')).toEqual([]);
  });
  test('formatCount', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1500)).toBe('1.5K');
    expect(formatCount(2_300_000)).toBe('2.3M');
  });
});
