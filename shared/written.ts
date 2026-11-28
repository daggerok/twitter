/// <reference lib="esnext" />
// =========================================================================
// The write signal, the fidelity-accounts way (its SHEETS_KEY; owner 2026-11-28: "notify view app when we pushed data
// into google sheets"): after each batch the userscript wrote to a tab from x.com it leaves a mark in Tampermonkey
// storage, the same script on the viewer page passes it on, and the viewer rereads the tab it shows. A run writes a
// batch every 50 posts, a tab can hold 15,000 rows, so the viewer rereads at most once per RELOAD_GAP_MS and once more
// after the last mark. Pure rules; userscript/src/main.ts sets the mark, src/main.tsx rereads.
// =========================================================================

export const WRITTEN_KEY = 'xsync.written';
export const WRITTEN_MAX_AGE_MS = 60_000; // an older mark is not acted on when a viewer opens later (it loads the tab anyway)
export const RELOAD_GAP_MS = 60_000;

/** Rows the userscript just wrote to the tab of `handle`. */
export type Written = { at: number; handle: string; inserted: number; updated: number };

/** A mark worth acting on now: well formed and fresh. */
export function freshWritten(raw: unknown, now: number): Written | null {
  const w = raw as Partial<Written> | null;
  if (!w || typeof w !== 'object' || typeof w.at !== 'number' || typeof w.handle !== 'string' || !w.handle) return null;
  if (!(now - w.at >= 0 && now - w.at < WRITTEN_MAX_AGE_MS)) return null;
  return { at: w.at, handle: w.handle, inserted: Number(w.inserted) || 0, updated: Number(w.updated) || 0 };
}

/** How long the viewer waits before it rereads the tab: 0 when the last reread is older than the gap, else the rest of it. */
export const reloadDelay = (now: number, lastReloadAt: number, gap = RELOAD_GAP_MS): number => Math.max(0, Math.min(gap, lastReloadAt + gap - now));
