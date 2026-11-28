/// <reference types="bun" />
/// <reference lib="esnext" />
import { describe, expect, test } from 'bun:test';
import { parseTimeline, parseUser } from './parse';
import { ssrPayloads } from './ssr';

// the shape X streams into a profile page since Nov 2026 (made up ids and names): a script that hands a JS string
// literal holding the GraphQL answer to the router, then removes itself
const tweet = (id: string, text: string, replyTo = '') => ({
  __typename: 'Tweet', rest_id: id,
  core: { user_results: { result: { rest_id: '7', core: { screen_name: 'Some_Trader', name: 'Some <Trader>' } } } },
  counts: { favorite_count: 688, reply_count: 38, retweet_count: 19, quote_count: 2, bookmark_count: 5 },
  details: { created_at_ms: 1795866480000, full_text: text },
  views: { count: '51183' },
  ...(replyTo ? { reply_to_results: { rest_id: replyTo } } : {}),
});
const item = (id: string, t: unknown) => ({ entry_id: `tweet-${id}`, content: { __typename: 'TimelineTimelineItem', content: { __typename: 'TimelineTweet', tweet_results: { result: t } } } });
const timeline = {
  data: { user_result_by_screen_name: { id: 'x', result: { __typename: 'User', id: 'y', profile_user_replies_timeline: { id: 'z', timeline: { instructions: [
    { __typename: 'TimelineClearCache' },
    { __typename: 'TimelineAddEntries', entries: [
      item('2000', tweet('2000', 'The scoreboard...\n\nNo one "accepts" the challenge. </script>')),
      item('2001', tweet('2001', 'a reply in the thread', '2000')),
      { entry_id: 'cursor-bottom-1', content: { __typename: 'TimelineTimelineCursor', cursor_type: 'Bottom', value: 'CURSOR' } },
    ] },
  ] } } } } },
};
const user = { data: { user_result_by_screen_name: { id: 'x', result: { __typename: 'User', rest_id: '7', core: { screen_name: 'Some_Trader', name: 'Some Trader' }, legacy: { followers_count: 12 } } } } };
// the serializer's string literal: JSON escapes plus \x3C for "<"
const literal = (v: unknown) => JSON.stringify(JSON.stringify(v)).replace(/</g, '\\x3C');
const script = (v: unknown, n: number) => `<script nonce="n">($R=>$R[35].next($R[${n}]={kind:1,requestId:4,key:"abc{\\"count\\":20,\\"screenName\\":\\"Some_Trader\\"}",result:$R[${n + 1}]={kind:"Result.Ok",value:${literal(v)}}}))($R["tsr"]);document.currentScript.remove()</script>`;
const html = `<!doctype html><html><head><script>var a = "{\\"data\\" is not closed";</script></head><body><div id="react-root"></div>${script(user, 40)}${script(timeline, 43)}</body></html>`;

describe('ssrPayloads', () => {
  test('finds every GraphQL answer rendered into the page, a broken literal is skipped', () => {
    const found = ssrPayloads(html);
    expect(found).toEqual([user, timeline]);
  });
  test('no answers in a page without them', () => {
    expect(ssrPayloads('<html><body>"{"data"</body></html>')).toEqual([]);
    expect(ssrPayloads('')).toEqual([]);
  });
  test('the timeline answer parses like an intercepted one: exact kinds and counts, marked graphql', () => {
    const r = parseTimeline(ssrPayloads(html)[1], 'some_trader', '2026-11-28T15:00:00.000Z');
    expect(r.posts.map((p) => [p.id, p.type, p.replies, p.likes, p.views, p.source])).toEqual([
      ['2000', 'post', 38, 688, 51183, 'graphql'],
      ['2001', 'reply', 38, 688, 51183, 'graphql'],
    ]);
    expect(r.posts[0].text).toBe('The scoreboard...\n\nNo one "accepts" the challenge. </script>');
    expect(r.cursorBottom).toBe('CURSOR');
  });
  test('the account answer gives the handle in X\'s case', () => {
    expect(parseUser(ssrPayloads(html)[0])?.display_handle).toBe('Some_Trader');
    expect(parseUser(timeline)).toBeNull();
  });
});
