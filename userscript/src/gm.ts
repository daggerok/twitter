/// <reference lib="esnext" />
// Tampermonkey globals, typed here so no `@types/tampermonkey` package is needed, plus small JSON helpers.
import type { Post } from '../../shared/post';

export type RunMode = 'full' | 'incremental';
export type StopReason = 'stopped' | 'caught_up' | 'end_of_timeline' | 'max_posts' | 'max_minutes' | 'rate_limited' | 'left_profile';

export type Run = {
  run_id: string;
  handle: string;
  started_at: string;
  finished_at: string;
  mode: RunMode;
  posts_seen: number;
  posts_new: number;
  stop_reason: StopReason | '';
  userscript_version: string;
  source: 'graphql' | 'dom' | 'mixed' | 'none';
};

export type Batch = { id: string; handle: string; run_id: string; posts: Post[]; created_at: string };

export type Meta = { newestId: string; count: number; updatedAt: string };

export type Status = {
  state: 'idle' | 'running' | 'paused' | 'done';
  handle: string;
  mode: RunMode;
  seen: number;
  fresh: number;
  started_at: string;
  message: string;
  stop_reason: StopReason | '';
};

declare function GM_getValue(key: string, defaultValue?: unknown): unknown;
declare function GM_setValue(key: string, value: unknown): void;
declare function GM_deleteValue(key: string): void;
declare function GM_addValueChangeListener(key: string, cb: (key: string, oldValue: unknown, newValue: unknown, remote: boolean) => void): number;
declare function GM_registerMenuCommand(caption: string, cb: () => void): number;
declare const unsafeWindow: Window & typeof globalThis;
declare const GM_info: { script: { version: string; name: string } } | undefined;

const gm = (name: string): unknown => {
  try {
    return (globalThis as unknown as Record<string, unknown>)[name];
  } catch {
    return undefined;
  }
};

export const hasGM = (): boolean => typeof gm('GM_getValue') === 'function';

export function gmGet<T>(key: string, fallback: T): T {
  try {
    const v = GM_getValue(key);
    return v === undefined || v === null ? fallback : (v as T);
  } catch {
    return fallback;
  }
}

export function gmSet(key: string, value: unknown): void {
  try { GM_setValue(key, value); } catch { /* storage unavailable: the badge reports it */ }
}

export function gmDel(key: string): void {
  try { GM_deleteValue(key); } catch { /* ignore */ }
}

export function gmOnChange(key: string, cb: (value: unknown) => void): void {
  try {
    if (typeof gm('GM_addValueChangeListener') === 'function') GM_addValueChangeListener(key, (_k, _o, n) => cb(n));
  } catch { /* older managers: the viewer polls through hello instead */ }
}

export function gmMenu(caption: string, cb: () => void): void {
  try {
    if (typeof gm('GM_registerMenuCommand') === 'function') GM_registerMenuCommand(caption, cb);
  } catch { /* ignore */ }
}

export function pageWindow(): Window & typeof globalThis {
  try {
    return typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  } catch {
    return window;
  }
}

export function scriptVersion(): string {
  try {
    return (typeof GM_info !== 'undefined' && GM_info ? GM_info.script.version : '') || 'dev';
  } catch {
    return 'dev';
  }
}

export const KEYS = {
  settings: 'xsync.settings',
  outbox: 'xsync.outbox',
  runs: 'xsync.runs',
  status: 'xsync.status',
  meta: (handle: string) => `xsync.meta.${handle.toLowerCase()}`,
  seen: (handle: string) => `xsync.seen.${handle.toLowerCase()}`,
};

export const MAX_RUNS = 50;

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
