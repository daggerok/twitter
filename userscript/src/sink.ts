/// <reference lib="esnext" />
// =========================================================================
// Sink: dedupes the posts of one run and stores them. Two ways out:
// - direct: when the viewer shared a fresh Google token (Tampermonkey storage, see bridge.ts and sheets-gm.ts)
//   each batch goes straight to the account's tab from x.com (append new rows, rewrite known ones)
// - outbox: otherwise, or when a direct write fails, the batch waits in `xsync.outbox`; the same userscript on
//   the viewer page hands it over (bridge.ts), the viewer writes it to Google Sheets and acks it
// Nothing leaves the browser except the Sheets API calls.
// =========================================================================
import { compareIds, type Post, type ProfileTab } from '../../shared/post';
import { gmGet, gmSet, KEYS, MAX_RUNS, newId, type Batch, type Run, type Status } from './gm';
import type { DirectWriter } from './sheets-gm';

export const FLUSH_EVERY_POSTS = 50;
export const FLUSH_EVERY_MS = 20_000;
export const MAX_OUTBOX_POSTS = 20_000; // keep the GM store bounded when the viewer is never opened

export class Sink {
  readonly posts = new Map<string, Post>();
  private pending: Post[] = [];
  private lastFlush = Date.now();
  newestId = '';
  oldestId = '';
  /** Set when the viewer shared a fresh Google token: batches go straight to the sheet, the outbox only on failure. */
  writer: DirectWriter | null = null;
  onWritten: (inserted: number, updated: number, error: string) => void = () => { /* badge */ };
  /** Writes run one after another; `done()` resolves when the last one has finished. */
  private chain: Promise<void> = Promise.resolve();

  constructor(readonly handle: string, readonly runId: string) {}

  done(): Promise<void> { return this.chain; }

  /** Add posts; returns how many ids were new to this run. */
  add(posts: Post[]): number {
    let fresh = 0;
    posts.forEach((p) => {
      if (!this.posts.has(p.id)) fresh += 1;
      this.posts.set(p.id, p);
      this.pending.push(p);
      if (!p.is_pinned) {
        if (!this.newestId || compareIds(p.id, this.newestId) > 0) this.newestId = p.id;
        if (!this.oldestId || compareIds(p.id, this.oldestId) < 0) this.oldestId = p.id;
      }
    });
    if (this.pending.length >= FLUSH_EVERY_POSTS || Date.now() - this.lastFlush > FLUSH_EVERY_MS) this.flush();
    return fresh;
  }

  /** Move the pending posts out: to the sheet when a writer is ready (the outbox on failure), else to the outbox. */
  flush(): void {
    this.lastFlush = Date.now();
    if (!this.pending.length) return;
    const byId = new Map<string, Post>();
    this.pending.forEach((p) => byId.set(p.id, p));
    this.pending = [];
    const batch: Batch = { id: newId('b'), handle: this.handle, run_id: this.runId, posts: Array.from(byId.values()), created_at: new Date().toISOString() };
    const w = this.writer;
    if (w && w.ready) {
      this.chain = this.chain.then(() => w.write(batch.posts)).then(
        (r) => this.onWritten(r.inserted, r.updated, ''),
        (e: unknown) => {
          this.onWritten(0, 0, e instanceof Error ? e.message : String(e));
          this.toOutbox(batch);
        },
      );
      return;
    }
    this.toOutbox(batch);
  }

  private toOutbox(batch: Batch): void {
    const outbox = gmGet<Batch[]>(KEYS.outbox, []);
    outbox.push(batch);
    let total = outbox.reduce((n, b) => n + b.posts.length, 0);
    while (total > MAX_OUTBOX_POSTS && outbox.length > 1) {
      const dropped = outbox.shift();
      total -= dropped ? dropped.posts.length : 0;
    }
    gmSet(KEYS.outbox, outbox);
  }
}

export function recordRun(run: Run): void {
  const runs = gmGet<Run[]>(KEYS.runs, []).filter((r) => r.run_id !== run.run_id);
  runs.push(run);
  while (runs.length > MAX_RUNS) runs.shift();
  gmSet(KEYS.runs, runs);
}

export function setStatus(s: Status): void {
  gmSet(KEYS.status, s);
}

/**
 * Where an incremental run on a profile tab stops. The viewer's per-tab id (newest complete row of that tab's kind in
 * the sheet) wins over this script's own memory of the tab, the higher of the two is taken; the old one-id-per-handle
 * memory is no longer read (the broken Nov 2026 run left an id of empty rows in it). '' = nothing known: a full run.
 */
export function knownNewestId(handle: string, tab: ProfileTab): string {
  const meta = gmGet<{ newestId?: string; newest?: Partial<Record<ProfileTab, string>> | null } | null>(KEYS.meta(handle), null);
  const viewer = meta && meta.newest ? (meta.newest[tab] || meta.newest.all || '') : '';
  const own = gmGet<string>(KEYS.seenTab(handle, tab), '');
  if (viewer && own) return compareIds(viewer, own) >= 0 ? viewer : own;
  return viewer || own;
}

export function rememberNewestId(handle: string, tab: ProfileTab, id: string): void {
  if (!id) return;
  const own = gmGet<string>(KEYS.seenTab(handle, tab), '');
  if (!own || compareIds(id, own) > 0) gmSet(KEYS.seenTab(handle, tab), id);
}
