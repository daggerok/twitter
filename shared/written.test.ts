/// <reference types="bun" />
/// <reference lib="esnext" />
import { describe, expect, test } from 'bun:test';
import { freshWritten, reloadDelay } from './written';

const now = 1_800_000_000_000;

describe('the viewer rereads the tab the userscript wrote', () => {
  test('freshWritten: the mark of a write a minute old at most', () => {
    expect(freshWritten({ at: now, handle: 'a', inserted: 3, updated: '2' }, now + 1_000)).toEqual({ at: now, handle: 'a', inserted: 3, updated: 2 });
    expect(freshWritten({ at: now, handle: 'a', inserted: 3, updated: 2 }, now + 60_000)).toBeNull();
    expect(freshWritten({ at: now + 1, handle: 'a' }, now)).toBeNull();
    expect(freshWritten({ at: now, handle: '' }, now)).toBeNull();
    expect(freshWritten('a', now)).toBeNull();
    expect(freshWritten(null, now)).toBeNull();
  });

  test('reloadDelay: at once after a quiet minute, else the rest of the minute', () => {
    expect(reloadDelay(now, 0)).toBe(0);
    expect(reloadDelay(now, now - 60_000)).toBe(0);
    expect(reloadDelay(now, now - 15_000)).toBe(45_000);
    // a clock set back never makes the wait longer than the gap
    expect(reloadDelay(now, now + 5_000)).toBe(60_000);
  });
});
