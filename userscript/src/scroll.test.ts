/// <reference types="bun" />
/// <reference lib="esnext" />
import { describe, expect, test } from 'bun:test';
import { samplePost } from '../../shared/post.test';
import { pageKey, TimelineFeed } from './scroll';

describe('TimelineFeed', () => {
  test('pageKey: one profile tab of one account, the handle in any case', () => {
    expect(['/Some_One', '/some_one/with_replies', '/Some_One/reposts', '/home', '/Some_One/status/1'].map(pageKey)).toEqual(['some_one/posts', 'some_one/replies', 'some_one/reposts', '', '']);
  });

  test('a run starts from the posts of its own tab only', () => {
    // Replies loaded, Posts clicked (a request), Replies shown again from X's memory (no request): the Posts answer must not start the Replies run
    const feed = new TimelineFeed();
    feed.onTimeline([samplePost({ id: '1' }), samplePost({ id: '2' })], 'some_one/posts');
    feed.onTimeline([samplePost({ id: '3' })], 'other/replies');
    expect(feed.waiting).toBe(3);
    feed.keepOnly('some_one/replies');
    expect(feed.waiting).toBe(0);
    feed.onTimeline([samplePost({ id: '4' })], 'some_one/replies');
    feed.onTimeline([samplePost({ id: '5' })], 'some_one/replies');
    feed.keepOnly('some_one/replies');
    expect(feed.take().map((p) => p.id)).toEqual(['4', '5']);
    expect(feed.waiting).toBe(0);
  });
});
