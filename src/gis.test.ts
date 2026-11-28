/// <reference types="bun" />
/// <reference lib="esnext" />
import { describe, expect, test } from 'bun:test';
import { usableToken } from './gis';

describe('the saved Google sign-in', () => {
  const now = 1_800_000_000_000;
  test('a token with more than a minute left is used after a reload', () => {
    expect(usableToken({ value: 'tok', expiresAt: now + 30 * 60_000 }, now)).toEqual({ value: 'tok', expiresAt: now + 30 * 60_000 });
    expect(usableToken({ value: 'tok', expiresAt: now + 61_000, extra: 1 }, now)).toEqual({ value: 'tok', expiresAt: now + 61_000 });
  });
  test('an expired, nearly expired or broken one is not: the silent renewal runs instead', () => {
    expect(usableToken({ value: 'tok', expiresAt: now - 1 }, now)).toBeNull();
    expect(usableToken({ value: 'tok', expiresAt: now + 60_000 }, now)).toBeNull();
    expect(usableToken({ value: '', expiresAt: now + 3_600_000 }, now)).toBeNull();
    expect(usableToken({ value: 'tok', expiresAt: '9' }, now)).toBeNull();
    expect(usableToken(null, now)).toBeNull();
    expect(usableToken('tok', now)).toBeNull();
  });
});
