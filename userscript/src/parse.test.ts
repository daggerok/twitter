/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { graphqlOperation, parseTimeline, parseUser } from './parse';

const fixture: unknown = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'user-tweets.json'), 'utf8'));

const SEEN = '2026-10-30T12:00:00.000Z';

describe('parseTimeline', () => {
  const r = parseTimeline(fixture, 'FixtureAcc', SEEN);
  const byId = new Map(r.posts.map((p) => [p.id, p]));

  test('keeps the 5 posts of the handle, skips the ad, the other author and the tombstone (an empty tweet_results is no entry)', () => {
    expect(r.posts.map((p) => p.id).sort()).toEqual([
      '1800000000000000001', '1900000000000000004', '1900000000000000007', '1900000000000000008', '1900000000000000009',
    ]);
    expect(r.skipped).toBe(3);
    expect(r.errors).toBe(0);
    expect(r.cursorBottom).toBe('DAABCgABbottom');
    expect(r.account).toEqual({ handle: 'fixtureacc', user_id: '44196397', display_name: 'Fixture Account', followers: 12345 });
  });

  test('pinned post: flag, expanded link, photo media, media t.co removed from the text, counts and views', () => {
    const p = byId.get('1800000000000000001');
    expect(p?.is_pinned).toBe(true);
    expect(p?.type).toBe('post');
    expect(p?.created_at).toBe('2025-01-06T12:00:00.000Z');
    expect(p?.text).toBe('Pinned post with a link https://example.com/article and a photo');
    expect(p?.links).toEqual(['https://example.com/article']);
    expect(p?.media).toEqual([{ type: 'photo', url: 'https://pbs.twimg.com/media/pic.jpg' }]);
    expect(p?.likes).toBe(10);
    expect(p?.bookmarks).toBe(4);
    expect(p?.views).toBe(500);
    expect(p?.url).toBe('https://x.com/fixtureacc/status/1800000000000000001');
    expect(p?.first_seen_at).toBe(SEEN);
    expect(p?.last_seen_at).toBe(SEEN);
  });

  test('long post takes the note_tweet text and its urls, handle read from the legacy user schema', () => {
    const p = byId.get('1900000000000000009');
    expect(p?.text).toBe('A long post that goes past 280 characters and is stored as a note tweet https://long.example.com/x');
    expect(p?.links).toEqual(['https://long.example.com/x']);
    expect(p?.handle).toBe('fixtureacc');
    expect(p?.is_pinned).toBe(false);
  });

  test('repost: original text, original author, best mp4 variant', () => {
    const p = byId.get('1900000000000000008');
    expect(p?.type).toBe('repost');
    expect(p?.reposted_id).toBe('1850000000000000005');
    expect(p?.reposted_handle).toBe('other');
    expect(p?.text).toBe('the original text that gets cut at one hundred and forty characters in the retweet legacy text so the parser must take the original');
    expect(p?.media).toEqual([{ type: 'video', url: 'https://video.twimg.com/high.mp4' }]);
    expect(p?.handle).toBe('fixtureacc');
  });

  test('quote inside TweetWithVisibilityResults: quoted_id, the quote url is not an external link', () => {
    const p = byId.get('1900000000000000007');
    expect(p?.type).toBe('quote');
    expect(p?.quoted_id).toBe('1850000000000000006');
    expect(p?.text).toBe('My take on this');
    expect(p?.links).toEqual([]);
    expect(p?.likes).toBe(5);
  });

  test('reply from a conversation module: in_reply_to fields lowercased', () => {
    const p = byId.get('1900000000000000004');
    expect(p?.type).toBe('reply');
    expect(p?.in_reply_to_id).toBe('1900000000000000003');
    expect(p?.in_reply_to_handle).toBe('someoneelse');
    expect(p?.conversation_id).toBe('1900000000000000003');
  });

  test('no handle keeps every author, an empty payload gives nothing', () => {
    expect(parseTimeline(fixture, '', SEEN).posts.length).toBe(6);
    expect(parseTimeline({}, 'x', SEEN)).toEqual({ posts: [], skipped: 0, errors: 0, cursorBottom: null, account: null });
    expect(parseTimeline(null, 'x', SEEN).posts).toEqual([]);
    expect(parseTimeline({ data: { user: { result: { timeline_v2: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries: [null, 1, { content: 'x' }] }] } } } } } }, 'x', SEEN).posts).toEqual([]);
  });

  test('a throwing entry is counted, the others are kept', () => {
    const poison = new Proxy({}, { get: () => { throw new Error('boom'); } });
    const json = { data: { user: { result: { timeline_v2: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries: [
      { content: { entryType: 'TimelineTimelineItem', itemContent: { itemType: 'TimelineTweet', tweet_results: { result: poison } } } },
      { content: { entryType: 'TimelineTimelineItem', itemContent: { itemType: 'TimelineTweet', tweet_results: { result: { rest_id: '5', core: { user_results: { result: { legacy: { screen_name: 'x' } } } }, legacy: { full_text: 'ok', created_at: 'Wed Oct 01 09:00:00 +0000 2025' } } } } } },
    ] }] } } } } } };
    const r2 = parseTimeline(json, 'x', SEEN);
    expect(r2.errors).toBe(1);
    expect(r2.posts.map((p) => p.id)).toEqual(['5']);
  });
});

describe('parseUser and urls', () => {
  test('UserByScreenName in both schemas', () => {
    expect(parseUser({ data: { user: { result: { rest_id: '7', core: { screen_name: 'Abc', name: 'A B C' }, legacy: { followers_count: 3 } } } } }))
      .toEqual({ handle: 'abc', user_id: '7', display_name: 'A B C', followers: 3 });
    expect(parseUser({ data: { user: { result: { rest_id: '7', legacy: { screen_name: 'Abc', name: 'A B C', followers_count: 3 } } } } })?.handle).toBe('abc');
    expect(parseUser({})).toBeNull();
  });

  test('graphqlOperation reads the operation after the query id', () => {
    expect(graphqlOperation('https://x.com/i/api/graphql/E3opETHurmVJflFsUBVuUQ/UserTweets?variables=%7B%7D')).toBe('UserTweets');
    expect(graphqlOperation('https://x.com/i/api/graphql/abc/UserTweetsAndReplies')).toBe('UserTweetsAndReplies');
    expect(graphqlOperation('https://x.com/i/api/2/notifications/all.json')).toBeNull();
  });
});
