/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { DEFAULTS, normalize } from './settings';

describe('settings', () => {
  test('defaults for garbage, clamps, max >= min', () => {
    expect(normalize(undefined)).toEqual(DEFAULTS);
    expect(normalize({ v: 2, maxPosts: 'abc', maxMinutes: 999 })).toEqual({ ...DEFAULTS, maxMinutes: 999 });
    expect(normalize({ v: 2, maxPosts: 500 }).maxPosts).toBe(500);
    // settings saved by 2.1.1 and earlier: the old limits are dropped, no limit by default
    expect(normalize({ maxPosts: 2000, maxMinutes: 15 })).toMatchObject({ v: 2, maxPosts: 0, maxMinutes: 0 });
    const s = normalize({ v: 2, delayMinMs: 5000, delayMaxMs: 1000, restMinSec: 30, restMaxSec: 1 });
    expect(s.delayMaxMs).toBe(5000);
    expect(s.restMaxSec).toBe(30);
    expect(normalize({ withReplies: 'yes' }).withReplies).toBe(false);
    expect(normalize({ withReplies: true }).withReplies).toBe(true);
  });
});
