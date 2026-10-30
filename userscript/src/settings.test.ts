/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { DEFAULTS, normalize } from './settings';

describe('settings', () => {
  test('defaults for garbage, clamps, max >= min', () => {
    expect(normalize(undefined)).toEqual(DEFAULTS);
    expect(normalize({ maxPosts: 'abc', maxMinutes: 999 })).toEqual({ ...DEFAULTS, maxMinutes: 240 });
    const s = normalize({ delayMinMs: 5000, delayMaxMs: 1000, restMinSec: 30, restMaxSec: 1 });
    expect(s.delayMaxMs).toBe(5000);
    expect(s.restMaxSec).toBe(30);
    expect(normalize({ withReplies: 'yes' }).withReplies).toBe(false);
    expect(normalize({ withReplies: true }).withReplies).toBe(true);
  });
});
