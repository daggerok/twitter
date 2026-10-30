/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { countFromLabel } from './dom-fallback';

describe('dom fallback counts', () => {
  test('aria-label numbers with separators and K/M suffixes', () => {
    expect(countFromLabel('1,234 Likes. Like')).toBe(1234);
    expect(countFromLabel('12.5K reposts')).toBe(12_500);
    expect(countFromLabel('1.2M views')).toBe(1_200_000);
    expect(countFromLabel('Like')).toBe(0);
    expect(countFromLabel('')).toBe(0);
  });
});
