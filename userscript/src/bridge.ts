/// <reference lib="esnext" />
// =========================================================================
// Viewer side of the userscript (daggerok.github.io/twitter and localhost): a postMessage bridge
// between the page and Tampermonkey storage. The page cannot read GM storage itself, so:
//   page -> script  { source: 'xsync-page',   type: 'hello' }                      -> script answers hello + outbox + runs + status
//   page -> script  { source: 'xsync-page',   type: 'ack',  ids: [batchId, ...] }  -> those batches leave the outbox
//   page -> script  { source: 'xsync-page',   type: 'meta', handle, newestId, count } -> stored for incremental runs
//   script -> page  { source: 'xsync-script', type: 'hello' | 'outbox' | 'runs' | 'status', ... }
// Only messages whose `event.source === window` are accepted on both sides.
// =========================================================================
import { gmGet, gmOnChange, gmSet, KEYS, type Batch, type Run, type Status } from './gm';

type PageMessage =
  | { source: 'xsync-page'; type: 'hello' }
  | { source: 'xsync-page'; type: 'ack'; ids: string[] }
  | { source: 'xsync-page'; type: 'meta'; handle: string; newestId: string; count: number };

const send = (msg: Record<string, unknown>): void => {
  window.postMessage({ source: 'xsync-script', ...msg }, location.origin);
};

export function installViewerBridge(version: string): void {
  const pushOutbox = () => send({ type: 'outbox', batches: gmGet<Batch[]>(KEYS.outbox, []) });
  const pushRuns = () => send({ type: 'runs', runs: gmGet<Run[]>(KEYS.runs, []) });
  const pushStatus = () => send({ type: 'status', status: gmGet<Status | null>(KEYS.status, null) });

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as Partial<PageMessage> | null;
    if (!data || data.source !== 'xsync-page') return;
    if (data.type === 'hello') {
      send({ type: 'hello', version });
      pushOutbox();
      pushRuns();
      pushStatus();
    } else if (data.type === 'ack' && Array.isArray(data.ids)) {
      const ids = new Set(data.ids.filter((x): x is string => typeof x === 'string'));
      const left = gmGet<Batch[]>(KEYS.outbox, []).filter((b) => !ids.has(b.id));
      gmSet(KEYS.outbox, left);
      send({ type: 'outbox', batches: left });
    } else if (data.type === 'meta' && typeof data.handle === 'string' && typeof data.newestId === 'string') {
      gmSet(KEYS.meta(data.handle), { newestId: data.newestId, count: Number(data.count) || 0, updatedAt: new Date().toISOString() });
    }
  });

  gmOnChange(KEYS.outbox, pushOutbox);
  gmOnChange(KEYS.runs, pushRuns);
  gmOnChange(KEYS.status, pushStatus);
  send({ type: 'hello', version });
}
