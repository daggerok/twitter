/// <reference types="bun" />
/// <reference lib="esnext" />
import { describe, expect, test } from 'bun:test';
import { pickFrontier, unfinishedAfter } from './sink';

describe('where an incremental run stops', () => {
  test('the viewer\'s id of the tab wins, the own memory serves when the viewer has none', () => {
    expect(pickFrontier('posts', { posts: '500', replies: '400', all: '500' }, '900', '')).toBe('500');
    expect(pickFrontier('posts', null, '900', '')).toBe('900');
    expect(pickFrontier('all', { all: '500' }, '', '')).toBe('500');
  });

  test('a tab the sheet has nothing of is read in full, never stopped at another tab\'s newest id', () => {
    // posts stored, no replies yet: the first run on Replies must not stop at the first reply older than the newest post
    expect(pickFrontier('replies', { posts: '500', replies: '', reposts: '', all: '500' }, '', '')).toBe('');
  });

  test('a run that was stopped is finished by the next one', () => {
    // 120 new posts above 500, Stop after 40: the sheet's newest row is now 620, the next run still heads for 500
    const left = unfinishedAfter('incremental', 'stopped', '500', '');
    expect(left).toBe('500');
    expect(pickFrontier('posts', { posts: '620', all: '620' }, '620', left)).toBe('500');
    // it gets there: nothing is left, the sheet's id is used again
    expect(unfinishedAfter('incremental', 'caught_up', '500', left)).toBe('');
    expect(pickFrontier('posts', { posts: '620', all: '620' }, '620', '')).toBe('620');
  });

  test('left the tab or failed counts as unfinished, a stopped full run keeps what was left before, the end clears it', () => {
    expect(unfinishedAfter('incremental', 'left_profile', '500', '')).toBe('500');
    expect(unfinishedAfter('full', 'stopped', '', '500')).toBe('500');
    expect(unfinishedAfter('full', 'end_of_timeline', '', '500')).toBe('');
    // a lower frontier from the sheet (a hole to refill) is never raised by the unfinished one
    expect(pickFrontier('posts', { posts: '300' }, '', '500')).toBe('300');
  });
});
