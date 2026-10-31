/// <reference lib="esnext" />
// Page side of the postMessage bridge to the userscript (see userscript/src/bridge.ts for the protocol).
import type { Post } from '../shared/post';

export type Batch = { id: string; handle: string; run_id: string; posts: Post[]; created_at: string };
export type Run = {
  run_id: string; handle: string; started_at: string; finished_at: string; mode: string;
  posts_seen: number; posts_new: number; stop_reason: string; userscript_version: string; source: string;
};
export type Status = { state: string; handle: string; mode: string; seen: number; fresh: number; started_at: string; message: string; stop_reason: string } | null;

export type BridgeEvents = {
  hello: (version: string) => void;
  outbox: (batches: Batch[]) => void;
  runs: (runs: Run[]) => void;
  status: (status: Status) => void;
};

const post = (msg: Record<string, unknown>): void => window.postMessage({ source: 'xsync-page', ...msg }, location.origin);

export function connectBridge(on: BridgeEvents): () => void {
  const listener = (event: MessageEvent) => {
    if (event.origin !== location.origin) return;
    const d = event.data as { source?: string; type?: string; version?: string; batches?: Batch[]; runs?: Run[]; status?: Status } | null;
    if (!d || d.source !== 'xsync-script') return;
    if (d.type === 'hello') on.hello(typeof d.version === 'string' ? d.version : '?');
    else if (d.type === 'outbox') on.outbox(Array.isArray(d.batches) ? d.batches : []);
    else if (d.type === 'runs') on.runs(Array.isArray(d.runs) ? d.runs : []);
    else if (d.type === 'status') on.status(d.status || null);
  };
  window.addEventListener('message', listener);
  post({ type: 'hello' });
  return () => window.removeEventListener('message', listener);
}

export const ackBatches = (ids: string[]): void => post({ type: 'ack', ids });
export const sendMeta = (handle: string, newestId: string, count: number): void => post({ type: 'meta', handle, newestId, count });
