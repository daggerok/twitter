/// <reference types="bun" />
/// <reference lib="esnext" />
import { describe, expect, test } from 'bun:test';
import { clickCloses, freshNotice, makeNotice, moved, pushNotice, runNotice, viewerOnScreen, type RunFacts } from './notice';

const now = 1_800_000_000_000;
const facts = (over: Partial<RunFacts> = {}): RunFacts => ({ handle: 'Some_One', posts: 37, inserted: 12, updated: 25, direct: true, stop: 'caught_up', error: '', auto: false, ...over });

describe('what a finished run says', () => {
  test('one fact a line, the title first', () => {
    expect(runNotice(facts())).toEqual({ level: 'ok', lines: ['Google Sheets updated', '@Some_One: 37 posts read', '12 new rows, 25 updated', 'Run ended: caught up'] });
    expect(runNotice(facts({ posts: 1, inserted: 1, updated: 0, stop: 'end_of_timeline' }))?.lines).toEqual(['Google Sheets updated', '@Some_One: 1 post read', '1 new row, 0 updated', 'Run ended: end of timeline']);
  });
  test('no Google token on x.com: the posts wait for the viewer', () => {
    expect(runNotice(facts({ direct: false, inserted: 0, updated: 0 }))?.lines).toEqual(['X posts collected', '@Some_One: 37 posts read', 'Open the viewer to store them', 'Run ended: caught up']);
  });
  test('a failed write is an error with its reason', () => {
    expect(runNotice(facts({ error: 'Sheets API 401: Invalid Credentials' }))).toEqual({ level: 'error', lines: ['Google Sheets update failed', '@Some_One: Sheets API 401: Invalid Credentials', '37 posts wait for the viewer'] });
    expect(runNotice(facts({ error: 'boom', direct: false, auto: true, posts: 0 }))?.lines[0]).toBe('X sync failed');
  });
  test('a Watch check with nothing new is silent, one with new rows or by hand is not', () => {
    expect(runNotice(facts({ auto: true, inserted: 0, updated: 20 }))).toBeNull();
    expect(runNotice(facts({ auto: true, inserted: 2 }))?.lines[0]).toBe('Google Sheets updated');
    expect(runNotice(facts({ auto: false, inserted: 0 }))?.lines[2]).toBe('0 new rows, 25 updated');
  });
});

describe('notices', () => {
  test('makeNotice drops empty lines; freshNotice takes a well formed young one only', () => {
    const n = makeNotice('ok', ['Google Sheets updated', '', '  @a: 1 post read '], now);
    expect(n).toEqual({ at: now, level: 'ok', lines: ['Google Sheets updated', '@a: 1 post read'] });
    expect(freshNotice(n, now + 5_000)).toEqual(n);
    expect(freshNotice(n, now + 60_000)).toBeNull();
    expect(freshNotice(n, now - 1)).toBeNull();
    expect(freshNotice({ at: now, level: 'loud', lines: ['x'] }, now)).toBeNull();
    expect(freshNotice({ at: now, level: 'ok', lines: [] }, now)).toBeNull();
    expect(freshNotice('text', now)).toBeNull();
  });
  test('pushNotice: the new one last, at most three, a repeat takes the place of the one on screen', () => {
    const a = makeNotice('ok', ['a'], 1);
    const b = makeNotice('error', ['b'], 2);
    expect(pushNotice([a, b], makeNotice('ok', ['a'], 3)).map((n) => n.at)).toEqual([2, 3]);
    expect(pushNotice([a, b, makeNotice('ok', ['c'], 3)], makeNotice('ok', ['d'], 4)).map((n) => n.lines[0])).toEqual(['b', 'c', 'd']);
  });
  test('viewerOnScreen: a heartbeat younger than two beats; a doubt means the browser notification goes out', () => {
    expect(viewerOnScreen(now - 39_000, now)).toBe(true);
    expect(viewerOnScreen(now - 40_000, now)).toBe(false);
    expect(viewerOnScreen(now + 1, now)).toBe(false);
    expect(viewerOnScreen(null, now)).toBe(false);
  });
  test('clickCloses: outside and after two seconds', () => {
    expect([clickCloses(false, 2_000), clickCloses(false, 1_999), clickCloses(true, 9_000)]).toEqual([true, false, false]);
  });
  test('moved: only the popups that were there and changed place, with the shift back to the old one', () => {
    expect(moved(new Map([['a', 10], ['b', 70]]), new Map([['c', 10], ['a', 70], ['b', 70.4]]))).toEqual([{ key: 'a', from: -60 }]);
  });
});
