/// <reference lib="esnext" />
import { gmGet, gmSet, KEYS } from './gm';

export type Settings = {
  maxPosts: number;      // stop a run at this many posts seen
  maxMinutes: number;    // stop a run after this many minutes
  delayMinMs: number;    // wait between scrolls, random in [min, max]
  delayMaxMs: number;
  restEvery: number;     // every N scrolls pause for restMinSec..restMaxSec seconds
  restMinSec: number;
  restMaxSec: number;
  idleScrolls: number;   // stop after this many scrolls without a new post
  withReplies: boolean;  // the viewer opens /with_replies instead of the posts tab
};

export const DEFAULTS: Settings = {
  maxPosts: 2000,
  maxMinutes: 15,
  delayMinMs: 1500,
  delayMaxMs: 4000,
  restEvery: 20,
  restMinSec: 5,
  restMaxSec: 12,
  idleScrolls: 8,
  withReplies: false,
};

const clampNum = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function normalize(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const s: Settings = {
    maxPosts: clampNum(r.maxPosts, 10, 50_000, DEFAULTS.maxPosts),
    maxMinutes: clampNum(r.maxMinutes, 1, 240, DEFAULTS.maxMinutes),
    delayMinMs: clampNum(r.delayMinMs, 500, 60_000, DEFAULTS.delayMinMs),
    delayMaxMs: clampNum(r.delayMaxMs, 500, 60_000, DEFAULTS.delayMaxMs),
    restEvery: clampNum(r.restEvery, 1, 1000, DEFAULTS.restEvery),
    restMinSec: clampNum(r.restMinSec, 0, 600, DEFAULTS.restMinSec),
    restMaxSec: clampNum(r.restMaxSec, 0, 600, DEFAULTS.restMaxSec),
    idleScrolls: clampNum(r.idleScrolls, 2, 100, DEFAULTS.idleScrolls),
    withReplies: r.withReplies === true,
  };
  if (s.delayMaxMs < s.delayMinMs) s.delayMaxMs = s.delayMinMs;
  if (s.restMaxSec < s.restMinSec) s.restMaxSec = s.restMinSec;
  return s;
}

export const loadSettings = (): Settings => normalize(gmGet(KEYS.settings, DEFAULTS));
export const saveSettings = (s: Settings): void => gmSet(KEYS.settings, normalize(s));
