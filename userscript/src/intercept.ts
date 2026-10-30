/// <reference lib="esnext" />
// =========================================================================
// Network interception in the page context: wraps window.fetch and XMLHttpRequest of x.com so every
// GraphQL timeline response (UserTweets, UserTweetsAndReplies, UserMedia, TweetDetail) and the
// UserByScreenName response reach the parser. Installed at document-start, before X's first request.
// Query ids are never matched, only the operation name segment of the url (graphqlOperation).
// =========================================================================
import { graphqlOperation, TIMELINE_OPERATIONS } from './parse';

export type PayloadHandler = (operation: string, json: unknown) => void;
export type StatusHandler = (operation: string, status: number) => void;

const WANTED = new Set<string>(Array.from(TIMELINE_OPERATIONS).concat(['UserByScreenName']));

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof input === 'object' && input !== null && typeof (input as Request).url === 'string') return (input as Request).url;
  return '';
}

/**
 * Patch the given window. Returns false when the page objects are out of reach (then the DOM fallback
 * is the only source). Safe to call once per page.
 */
export function installInterceptor(win: Window & typeof globalThis, onPayload: PayloadHandler, onStatus: StatusHandler): boolean {
  let ok = false;
  try {
    const origFetch = win.fetch;
    if (typeof origFetch === 'function') {
      win.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const res = origFetch.call(this, input, init);
        const op = graphqlOperation(urlOf(input));
        if (op && WANTED.has(op)) {
          res.then((r) => {
            onStatus(op, r.status);
            if (!r.ok) return;
            r.clone().text().then((text) => {
              try { onPayload(op, JSON.parse(text)); } catch { /* not json */ }
            }).catch(() => { /* body already consumed or aborted */ });
          }).catch(() => { /* network error: X shows its own retry */ });
        }
        return res;
      };
      ok = true;
    }
  } catch { /* fetch not writable */ }
  try {
    const proto = win.XMLHttpRequest && win.XMLHttpRequest.prototype;
    if (proto) {
      const origOpen = proto.open;
      const origSend = proto.send;
      const urls = new WeakMap<XMLHttpRequest, string>();
      proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]): void {
        urls.set(this, urlOf(url));
        return (origOpen as unknown as (...a: unknown[]) => void).apply(this, [method, url, ...rest]);
      } as typeof proto.open;
      proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
        const op = graphqlOperation(urls.get(this) || '');
        if (op && WANTED.has(op)) {
          this.addEventListener('load', () => {
            onStatus(op, this.status);
            if (this.status < 200 || this.status >= 300) return;
            try { onPayload(op, JSON.parse(String(this.responseText))); } catch { /* not json */ }
          });
        }
        return origSend.call(this, body);
      };
      ok = true;
    }
  } catch { /* XHR not patchable */ }
  return ok;
}
