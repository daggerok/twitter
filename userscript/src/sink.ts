/// <reference lib="esnext" />
// =========================================================================
// Sink: dedupes the posts of one run and hands them to the viewer through Tampermonkey storage.
// The same userscript runs on the viewer page (bridge.ts): there it reads `xsync.outbox` and posts the
// batches into the page, which writes them to Google Sheets and acks them. Nothing leaves the browser
// except the viewer's own Sheets API calls.
// =========================================================================
import { compareIds, type Post } from '../../shared/post';
import { gmGet, gmSet, KEYS, MAX_RUNS, newId, type Batch, type Run, type Status } from './gm';

export const FLUSH_EVERY_POSTS = 50;
export const FLUSH_EVERY_MS = 20_000;
export const MAX_OUTBOX_POSTS = 20_000; // keep the GM store bounded when the viewer is never opened

export class Sink {
  readonly posts = new Map<string, Post>();
  private pending: Post[] = [];
  private lastFlush = Date.now();
  newestId = '';
  oldestId = '';

  constructor(readonly handle: string, readonly runId: string) {}

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

  /** Move the pending posts to the outbox (one batch); a post captured twice keeps the last copy. */
  flush(): void {
    this.lastFlush = Date.now();
    if (!this.pending.length) return;
    const byId = new Map<string, Post>();
    this.pending.forEach((p) => byId.set(p.id, p));
    this.pending = [];
    const batch: Batch = { id: newId('b'), handle: this.handle, run_id: this.runId, posts: Array.from(byId.values()), created_at: new Date().toISOString() };
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

/** The newest id the viewer told us about for a handle (`meta`), else what this script saw itself. */
export function knownNewestId(handle: string): string {
  const meta = gmGet<{ newestId?: string } | null>(KEYS.meta(handle), null);
  const fromViewer = meta && typeof meta.newestId === 'string' ? meta.newestId : '';
  const own = gmGet<string>(KEYS.seen(handle), '');
  if (fromViewer && own) return compareIds(fromViewer, own) >= 0 ? fromViewer : own;
  return fromViewer || own;
}

export function rememberNewestId(handle: string, id: string): void {
  if (!id) return;
  const own = gmGet<string>(KEYS.seen(handle), '');
  if (!own || compareIds(id, own) > 0) gmSet(KEYS.seen(handle), id);
}
