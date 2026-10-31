/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { samplePost } from '../shared/post.test';
import { applyFilters, EMPTY_FILTERS, formatCount, linkify, postsFromJson, toCsv } from './filters';

const posts = [
  samplePost({ id: '3', handle: 'a', text: 'Hello world', created_at: '2026-03-01T00:00:00.000Z', likes: 5, type: 'post' }),
  samplePost({ id: '2', handle: 'b', text: 'Reply to you', created_at: '2026-02-01T00:00:00.000Z', likes: 50, type: 'reply', media: [{ type: 'photo', url: 'u' }] }),
  samplePost({ id: '1', handle: 'a', text: 'old quote', created_at: '2026-01-01T00:00:00.000Z', likes: 500, views: 9, type: 'quote' }),
];

describe('applyFilters', () => {
  test('no filter: newest first', () => {
    expect(applyFilters(posts, EMPTY_FILTERS).map((p) => p.id)).toEqual(['3', '2', '1']);
  });
  test('hidden posts are out of the feed and listed alone with showHidden', () => {
    const list = [...posts, samplePost({ id: '0', hidden: true, text: 'noise' })];
    expect(applyFilters(list, EMPTY_FILTERS).map((p) => p.id)).toEqual(['3', '2', '1']);
    expect(applyFilters(list, { ...EMPTY_FILTERS, showHidden: true }).map((p) => p.id)).toEqual(['0']);
  });
  test('handles, types, dates, media, search words, sort', () => {
    expect(applyFilters(posts, { ...EMPTY_FILTERS, handles: ['a'] }).map((p) => p.id)).toEqual(['3', '1']);
    expect(applyFilters(posts, { ...EMPTY_FILTERS, types: ['reply', 'quote'] }).map((p) => p.id)).toEqual(['2', '1']);
    expect(applyFilters(posts, { ...EMPTY_FILTERS, from: '2026-02-01', to: '2026-02-28' }).map((p) => p.id)).toEqual(['2']);
    expect(applyFilters(posts, { ...EMPTY_FILTERS, hasMedia: true }).map((p) => p.id)).toEqual(['2']);
    expect(applyFilters(posts, { ...EMPTY_FILTERS, search: 'WORLD hello' }).map((p) => p.id)).toEqual(['3']);
    expect(applyFilters(posts, { ...EMPTY_FILTERS, search: '@b' }).map((p) => p.id)).toEqual(['2']);
    expect(applyFilters(posts, { ...EMPTY_FILTERS, sort: 'likes' }).map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(applyFilters(posts, { ...EMPTY_FILTERS, sort: 'views' }).map((p) => p.id)).toEqual(['1', '3', '2']);
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
