/// <reference lib="esnext" />
// =========================================================================
// Viewer side of the userscript (daggerok.github.io/twitter and localhost): a postMessage bridge
// between the page and Tampermonkey storage. The page cannot read GM storage itself, so:
//   page -> script  { source: 'xsync-page',   type: 'hello' }                      -> script answers hello + outbox + runs + status
//   page -> script  { source: 'xsync-page',   type: 'ack',  ids: [batchId, ...] }  -> those batches leave the outbox
//   page -> script  { source: 'xsync-page',   type: 'meta', handle, newestId, count } -> stored for incremental runs
//   script -> page  { source: 'xsync-script', type: 'hello' | 'outbox' | 'runs' | 'status', ... }
// Both sides accept a message only from their own origin (`event.origin === location.origin`) with the source tag.
// =========================================================================
import { gmGet, gmOnChange, gmSet, GOOGLE_KEY, KEYS, pageWindow, type Batch, type Run, type Status } from './gm';
import { isCredsFresh, type GoogleCreds } from '../../shared/post';

type PageMessage =
  | { source: 'xsync-page'; type: 'hello' }
  | { source: 'xsync-page'; type: 'ack'; ids: string[] }
  | { source: 'xsync-page'; type: 'meta'; handle: string; newestId: string; count: number };

// Tampermonkey hands the script a wrapped `window` in some modes: messages go through and come from the real page window,
// so the check is the origin plus the source tag, never `event.source === window` (it was false under the wrapper and
// every message of the page was dropped, 2.0.2)
const send = (msg: Record<string, unknown>): void => {
  pageWindow().postMessage({ source: 'xsync-script', ...msg }, location.origin);
};

export function installViewerBridge(version: string): void {
  // a DOM stamp the page can read from any world, even when postMessage never arrives: tells "script runs" from "script absent"
  const stamp = () => { try { document.documentElement.dataset.xsync = version; } catch { /* ignore */ } };
  stamp();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stamp);
  const pushOutbox = () => send({ type: 'outbox', batches: gmGet<Batch[]>(KEYS.outbox, []) });
  const pushRuns = () => send({ type: 'runs', runs: gmGet<Run[]>(KEYS.runs, []) });
  const pushStatus = () => send({ type: 'status', status: gmGet<Status | null>(KEYS.status, null) });

  pageWindow().addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== location.origin) return;
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

  // the viewer puts its Google token, expiry and spreadsheet id into a DOM attribute (same origin page, token already
  // in its memory); polled here because the DOM is shared by every world, unlike messages. Stored for the x.com side.
  let lastCreds = '';
  const pullCreds = () => {
    try {
      const raw = document.documentElement.dataset.xsyncGoogle || '';
      if (raw === lastCreds) return;
      lastCreds = raw;
      if (!raw) { gmSet(GOOGLE_KEY, null); return; }
      const c = JSON.parse(raw) as GoogleCreds;
      gmSet(GOOGLE_KEY, isCredsFresh(c) ? c : null);
    } catch { /* bad json: keep the last */ }
  };
  pullCreds();
  setInterval(pullCreds, 2000);

  gmOnChange(KEYS.outbox, pushOutbox);
  gmOnChange(KEYS.runs, pushRuns);
  gmOnChange(KEYS.status, pushStatus);
  send({ type: 'hello', version });
}
