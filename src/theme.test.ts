/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { isDark, isNight, isThemeMode, nextMode, themeIcon, themeTitle } from './theme';

const at = (h: number) => new Date(2026, 9, 31, h, 30);

describe('theme modes', () => {
  test('night is 19:00 to 06:59 by the local clock', () => {
    expect([0, 6, 19, 23].map((h) => isNight(at(h)))).toEqual([true, true, true, true]);
    expect([7, 12, 18].map((h) => isNight(at(h)))).toEqual([false, false, false]);
  });
  test('a click cycles light, dark, auto; stored values are validated', () => {
    expect(nextMode('light')).toBe('dark'); expect(nextMode('dark')).toBe('auto'); expect(nextMode('auto')).toBe('light');
    expect(isThemeMode('auto')).toBe(true); expect(isThemeMode('blue')).toBe(false); expect(isThemeMode(null)).toBe(false);
  });
  test('auto follows the clock, manual modes do not', () => {
    expect(isDark('auto', true)).toBe(true); expect(isDark('auto', false)).toBe(false);
    expect(isDark('dark', false)).toBe(true); expect(isDark('light', true)).toBe(false);
  });
  test('icon: manual shows the other theme (sun on dark), auto shows the current one with an A', () => {
    expect(themeIcon('dark', false)).toEqual({ icon: '☀', auto: false });
    expect(themeIcon('light', true)).toEqual({ icon: '🌙', auto: false });
    expect(themeIcon('auto', true)).toEqual({ icon: '🌙', auto: true });
    expect(themeIcon('auto', false)).toEqual({ icon: '☀', auto: true });
    expect(themeTitle('auto', true)).toContain('night');
    expect(themeTitle('dark', false)).toContain('automatic');
  });
});
