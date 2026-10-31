/// <reference lib="esnext" />
// =========================================================================
// Network interception of x.com: every GraphQL timeline response (UserTweets, UserTweetsAndReplies, UserMedia,
// TweetDetail) and the UserByScreenName answer reach the parser. Query ids are never matched, only the operation
// name segment of the url.
//
// Two channels, both installed at document-start, the first one that works wins (payloads are deduped by url+size):
// 1. a script element injected into the page itself (GM_addElement, which Tampermonkey lets through the page's
//    CSP; a plain script element as fallback). It wraps the page's own fetch and XMLHttpRequest and posts every
//    wanted response body to the window as a message `{ source: 'xsync-net', op, status, text }`. This works in
//    every Tampermonkey sandbox, the owner's 2.1.x runs fell back to the DOM reader because the direct patch below
//    did not reach the page's fetch
// 2. a direct patch of unsafeWindow.fetch and XMLHttpRequest, when the script runs in the page context
// =========================================================================
import { graphqlOperation, TIMELINE_OPERATIONS } from './parse';
import { gmAddScript, pageWindow } from './gm';

export type PayloadHandler = (operation: string, json: unknown) => void;
export type StatusHandler = (operation: string, status: number) => void;

const WANTED = Array.from(TIMELINE_OPERATIONS).concat(['UserByScreenName']);

/** The code that runs inside the page: no imports, nothing but what the page already has. */
function pageCode(wanted: string[]): string {
  return `(function () {
  if (window.__xsyncNet) return;
  window.__xsyncNet = true;
  var wanted = ${JSON.stringify(wanted)};
  var opOf = function (url) { var m = /\\/i\\/api\\/graphql\\/[^/]+\\/([A-Za-z0-9_]+)/.exec(String(url || '')); return m && wanted.indexOf(m[1]) >= 0 ? m[1] : null; };
  var urlOf = function (input) { try { return typeof input === 'string' ? input : input && input.url ? input.url : input && input.href ? input.href : String(input); } catch (e) { return ''; } };
  var post = function (op, status, text) { try { window.postMessage({ source: 'xsync-net', op: op, status: status, text: text }, location.origin); } catch (e) {} };
  var f = window.fetch;
  if (typeof f === 'function') {
    window.fetch = function (input, init) {
      var res = f.apply(this, arguments);
      var op = opOf(urlOf(input));
      if (op) res.then(function (r) { if (!r.ok) { post(op, r.status, ''); return; } r.clone().text().then(function (t) { post(op, r.status, t); }).catch(function () {}); }).catch(function () {});
      return res;
    };
  }
  var proto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (proto) {
    var open = proto.open, send = proto.send;
    proto.open = function (method, url) { this.__xsyncOp = opOf(urlOf(url)); return open.apply(this, arguments); };
    proto.send = function () {
      var op = this.__xsyncOp;
      if (op) this.addEventListener('load', function () { post(op, this.status, this.status >= 200 && this.status < 300 ? String(this.responseText) : ''); });
      return send.apply(this, arguments);
    };
  }
})();`;
}

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof input === 'object' && input !== null && typeof (input as Request).url === 'string') return (input as Request).url;
  return '';
}

/**
 * Install both channels. Returns true when at least one is in place (the injected script cannot be verified from
 * here; its first message proves it). Payloads seen twice (both channels alive) are reported once.
 */
export function installInterceptor(onPayload: PayloadHandler, onStatus: StatusHandler): boolean {
  const win = pageWindow();
  const seen = new Map<string, number>(); // op+length -> time, to drop the duplicate of a payload both channels saw
  const report = (op: string, status: number, text: string) => {
    onStatus(op, status);
    if (!text) return;
    const key = `${op}:${text.length}`;
    const now = Date.now();
    const last = seen.get(key) || 0;
    if (now - last < 5000) return;
    seen.set(key, now);
    if (seen.size > 200) { const first = seen.keys().next().value; if (first !== undefined) seen.delete(first); }
    try { onPayload(op, JSON.parse(text)); } catch { /* not json */ }
  };

  // 1. the page script: its messages come back through the window
  let injected = false;
  try {
    injected = gmAddScript(pageCode(WANTED));
  } catch { injected = false; }
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== location.origin) return;
    const d = event.data as { source?: string; op?: string; status?: number; text?: string } | null;
    if (!d || d.source !== 'xsync-net' || typeof d.op !== 'string') return;
    report(d.op, typeof d.status === 'number' ? d.status : 0, typeof d.text === 'string' ? d.text : '');
  });

  // 2. the direct patch, for the sandboxes where unsafeWindow is the page's window
  let direct = false;
  try {
    const origFetch = win.fetch;
    if (typeof origFetch === 'function' && !(win as unknown as { __xsyncNet?: boolean }).__xsyncNet) {
      win.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const res = origFetch.call(this, input, init);
        const op = graphqlOperation(urlOf(input));
        if (op && WANTED.includes(op)) {
          res.then((r) => {
            if (!r.ok) { report(op, r.status, ''); return; }
            r.clone().text().then((text) => report(op, r.status, text)).catch(() => { /* consumed */ });
          }).catch(() => { /* network error */ });
        }
        return res;
      };
      direct = true;
    }
  } catch { /* fetch not writable */ }
  return injected || direct;
}
