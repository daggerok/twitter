/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { graphqlOperation, isTimelineOperation, parseTimeline, parseUser } from './parse';

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
    expect(r.account).toEqual({ handle: 'FixtureAcc', display_handle: 'FixtureAcc', user_id: '44196397', display_name: 'Fixture Account', followers: 12345 });
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
    expect(p?.url).toBe('https://x.com/FixtureAcc/status/1800000000000000001');
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
    expect(p?.reposted_handle).toBe('Other');
    expect(p?.text).toBe('the original text that gets cut at one hundred and forty characters in the retweet legacy text so the parser must take the original');
    expect(p?.media).toEqual([{ type: 'video', url: 'https://video.twimg.com/high.mp4' }]);
    expect(p?.handle).toBe('FixtureAcc');
  });

  test('quote inside TweetWithVisibilityResults: quoted_id, the quote url is not an external link', () => {
    const p = byId.get('1900000000000000007');
    expect(p?.type).toBe('quote');
    expect(p?.quoted_id).toBe('1850000000000000006');
    expect(p?.text).toBe('My take on this');
    expect(p?.links).toEqual([]);
    expect(p?.likes).toBe(5);
  });

  test('reply from a conversation module: in_reply_to fields as X writes them', () => {
    const p = byId.get('1900000000000000004');
    expect(p?.type).toBe('reply');
    expect(p?.in_reply_to_id).toBe('1900000000000000003');
    expect(p?.in_reply_to_handle).toBe('SomeoneElse');
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
      .toEqual({ handle: 'Abc', display_handle: 'Abc', user_id: '7', display_name: 'A B C', followers: 3 });
    expect(parseUser({ data: { user: { result: { rest_id: '7', legacy: { screen_name: 'Abc', name: 'A B C', followers_count: 3 } } } } })?.handle).toBe('Abc');
    expect(parseUser({})).toBeNull();
  });

  test('graphqlOperation reads the operation after the query id', () => {
    expect(graphqlOperation('https://x.com/i/api/graphql/E3opETHurmVJflFsUBVuUQ/UserTweets?variables=%7B%7D')).toBe('UserTweets');
    expect(graphqlOperation('https://x.com/i/api/graphql/abc/UserTweetsAndReplies')).toBe('UserTweetsAndReplies');
    expect(graphqlOperation('https://x.com/i/api/2/notifications/all.json')).toBeNull();
  });

  test('isTimelineOperation: the classic names and the 2026 *Timeline ones, never the side queries', () => {
    ['UserTweets', 'UserTweetsAndReplies', 'UserMedia', 'TweetDetail', 'UserRepliesTimeline', 'UserTweetsTimeline', 'UserMediaTimeline', 'UserHighlightsTimeline']
      .forEach((op) => expect(isTimelineOperation(op)).toBe(true));
    ['UserByScreenName', 'ViewerBadgeCounts', 'ProfileSpotlightsQuery', 'SidebarUserRecommendations', 'DataSaverMode', 'UsersByRestIds', 'ExploreSidebar']
      .forEach((op) => expect(isTimelineOperation(op)).toBe(false));
  });
});

describe('the 2026 payload spelling (user_result, timeline_response, __typename)', () => {
  const tweet = (id: string, text: string) => ({ __typename: 'Tweet', rest_id: id, core: { user_results: { result: { rest_id: '1', core: { screen_name: 'I_Am_The_ICT', name: 'ICT' } } } }, views: { count: '12' }, legacy: { full_text: text, created_at: 'Fri Oct 30 08:16:00 +0000 2026', lang: 'en', conversation_id_str: id, favorite_count: 3 } });
  const json = { data: { user_result: { result: { timeline_response: { timeline: { instructions: [
    { __typename: 'TimelinePinEntry', entry: { entryId: 'tweet-1', content: { __typename: 'TimelineTimelineItem', content: { __typename: 'TimelineTweet', tweet_results: { result: tweet('1', 'pinned') } } } } },
    { __typename: 'TimelineAddEntries', entries: [
      { entryId: 'tweet-2', content: { __typename: 'TimelineTimelineItem', content: { __typename: 'TimelineTweet', tweet_results: { result: tweet('2', 'plain') } } } },
      { entryId: 'conv-3', content: { __typename: 'TimelineTimelineModule', items: [{ entryId: 'conv-3-tweet-3', item: { content: { __typename: 'TimelineTweet', tweet_results: { result: tweet('3', 'in a module') } } } }] } },
      { entryId: 'cursor-bottom', content: { __typename: 'TimelineTimelineCursor', cursorType: 'Bottom', value: 'next' } },
    ] },
  ] } } } } } };
  test('every post is found, pinned flagged, the cursor read, the account seen', () => {
    const r = parseTimeline(json, 'i_am_the_ict', SEEN);
    expect(r.posts.map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(r.posts[0].is_pinned).toBe(true);
    expect(r.posts[1].views).toBe(12);
    expect(r.cursorBottom).toBe('next');
    expect(r.account?.display_handle).toBe('I_Am_The_ICT');
  });
});

describe('the other person in a reply', () => {
  const user = (h: string) => ({ core: { user_results: { result: { rest_id: h, core: { screen_name: h, name: h } } } } });
  const tw = (id: string, h: string, text: string, extra: Record<string, unknown> = {}) => ({ __typename: 'Tweet', rest_id: id, ...user(h), legacy: { full_text: text, created_at: 'Fri Oct 30 08:16:00 +0000 2026', conversation_id_str: '1', ...extra } });
  const item = (t: unknown) => ({ item: { content: { __typename: 'TimelineTweet', tweet_results: { result: t } } } });
  const json = { data: { user_result: { result: { timeline_response: { timeline: { instructions: [{ __typename: 'TimelineAddEntries', entries: [
    { entryId: 'conv-1', content: { __typename: 'TimelineTimelineModule', items: [
      item(tw('1', 'Other', 'What do you think?')),
      item(tw('2', 'Acc', '@Other I think so', { in_reply_to_status_id_str: '1', in_reply_to_screen_name: 'Other' })),
      item(tw('3', 'Acc', '@Acc and more', { in_reply_to_status_id_str: '2', in_reply_to_screen_name: 'Acc' })),
    ] } },
  ] }] } } } } } };
  test('the parent text of a reply to someone else is kept, a self-thread parent is not, the other author is never a post', () => {
    const r = parseTimeline(json, 'acc', SEEN);
    expect(r.posts.map((p) => p.id)).toEqual(['2', '3']);
    expect(r.posts[0].in_reply_to_text).toBe('What do you think?');
    expect(r.posts[1].in_reply_to_text).toBe('');
    expect(r.skipped).toBe(1);
  });
  test('in a conversation only its newest post of the account marks the place in the timeline, the older ones are context', () => {
    // today's answer under the account's own post of a month ago: the old post must not end an incremental run
    expect(parseTimeline(json, 'acc', SEEN).posts.map((p) => [p.id, p.context === true])).toEqual([['2', true], ['3', false]]);
  });
});

describe('the Nov 2026 api (api.x.com, user_result_by_screen_name, details, counts, media_entities2)', () => {
  const user = (h: string) => ({ core: { user_results: { result: { __typename: 'User', rest_id: `u-${h}`, core: { screen_name: h, name: h } } } } });
  const ms = Date.parse('2026-11-20T15:00:00.000Z');
  const tw = (id: string, h: string, text: string, extra: Record<string, unknown> = {}) => ({
    __typename: 'Tweet', rest_id: id, ...user(h),
    details: { created_at_ms: ms, full_text: text, display_text_range: [0, Array.from(text).length] },
    counts: { favorite_count: 131, retweet_count: 2, reply_count: 14, quote_count: 1, bookmark_count: 3 },
    legacy: { conversation_id_str: '10', lang: 'en' },
    views: { count: '6000' }, url_entities: [], media_entities2: [],
    ...extra,
  });
  const item = (t: unknown) => ({ __typename: 'TimelineTimelineItem', content: { __typename: 'TimelineTweet', tweet_results: { result: t } } });
  const withMedia = tw('13', 'Acc', 'Look at this https://t.co/abc https://t.co/pic', {
    details: { created_at_ms: ms, full_text: 'Look at this https://t.co/abc https://t.co/pic', display_text_range: [0, 29] },
    url_entities: [{ url: 'https://t.co/abc', expanded_url: 'https://example.com/a', display_url: 'example.com/a' }],
    media_entities2: [{ type: 'photo', media_url_https: 'https://pbs.twimg.com/media/p.jpg', indices: [30, 46] }],
  });
  const json = { data: { user_result_by_screen_name: { result: { __typename: 'User', profile_user_replies_timeline: { timeline: { instructions: [
    { __typename: 'TimelinePinEntry', entry: { entry_id: 'tweet-12', content: item(tw('12', 'Acc', 'pinned one')) } },
    { __typename: 'TimelineAddEntries', entries: [
      { entry_id: 'conv-10', content: { __typename: 'TimelineTimelineModule', items: [
        { entry_id: 'conv-10-tweet-10', item: item(tw('10', 'Other', 'What do you think?')) },
        { entry_id: 'conv-10-tweet-11', item: item(tw('11', 'Acc', '@Other Happy Wife, Happy Home.', { reply_to_results: { rest_id: '10' }, reply_to_user_results: { result: { core: { screen_name: 'Other' } } } })) },
      ] } },
      { entry_id: 'tweet-13', content: item(withMedia) },
      { entry_id: 'tweet-14', content: item(tw('14', 'Acc', 'RT @Other: original', { legacy: { conversation_id_str: '9', lang: 'en', retweeted_status_results: { result: tw('9', 'Other', 'the original text in full') } } })) },
      { entry_id: 'tweet-15', content: item(tw('15', 'Acc', 'My take', { quoted_tweet_results: { result: tw('8', 'Other', 'quoted') } })) },
      { entry_id: 'cursor-bottom-1', content: { __typename: 'TimelineTimelineCursor', cursor_type: 'Bottom', value: 'next-page' } },
    ] },
  ] } } } } } };
  const r = parseTimeline(json, 'acc', SEEN);
  const byId = new Map(r.posts.map((p) => [p.id, p]));

  test('every post of the account is found, the other author only gives the quote, the cursor is read', () => {
    expect(r.posts.map((p) => p.id).sort()).toEqual(['11', '12', '13', '14', '15']);
    expect(r.errors).toBe(0);
    expect(r.cursorBottom).toBe('next-page');
    expect(byId.get('12')?.is_pinned).toBe(true);
  });

  test('date from created_at_ms, counts from counts, views, lang', () => {
    const p = byId.get('11');
    expect(p?.created_at).toBe('2026-11-20T15:00:00.000Z');
    expect([p?.likes, p?.reposts, p?.replies, p?.quotes, p?.bookmarks, p?.views]).toEqual([131, 2, 14, 1, 3, 6000]);
    expect(p?.lang).toBe('en');
  });

  test('a reply: parent id and handle from reply_to_results, the parent text kept', () => {
    const p = byId.get('11');
    expect(p?.type).toBe('reply');
    expect(p?.in_reply_to_id).toBe('10');
    expect(p?.in_reply_to_handle).toBe('Other');
    expect(p?.in_reply_to_text).toBe('What do you think?');
  });

  test('media from media_entities2, its t.co cut by display_text_range, links expanded from url_entities', () => {
    const p = byId.get('13');
    expect(p?.text).toBe('Look at this https://example.com/a');
    expect(p?.links).toEqual(['https://example.com/a']);
    expect(p?.media).toEqual([{ type: 'photo', url: 'https://pbs.twimg.com/media/p.jpg' }]);
  });

  test('a repost from legacy.retweeted_status_results, a quote from quoted_tweet_results', () => {
    expect(byId.get('14')?.type).toBe('repost');
    expect(byId.get('14')?.reposted_id).toBe('9');
    expect(byId.get('14')?.reposted_handle).toBe('Other');
    expect(byId.get('14')?.text).toBe('the original text in full');
    expect(byId.get('15')?.type).toBe('quote');
    expect(byId.get('15')?.quoted_id).toBe('8');
  });

  test('the operation name of the api.x.com url', () => {
    expect(graphqlOperation('https://api.x.com/graphql/AbC-12_x/UserRepliesTimeline?variables=%7B%7D')).toBe('UserRepliesTimeline');
    expect(graphqlOperation('https://api.x.com/graphql/AbC/UserOriginalsTimeline')).toBe('UserOriginalsTimeline');
    expect(isTimelineOperation('UserOriginalsTimeline')).toBe(true);
    expect(isTimelineOperation('UserRepostsTimeline')).toBe(true);
    expect(isTimelineOperation('whoToFollowListQuery')).toBe(false);
  });
});
