/// <reference lib="esnext" />
// =========================================================================
// The popups of 🔔 (shared/notice.ts). A port of fidelity-accounts src/viewer/ui/Notices.tsx, with its behaviour:
// they lie over the right end of the toolbar in the toolbar's surface; the border and the dot are the app's emerald for
// a success and rose for an error. A success closes by itself after 10 s, an error stays until ✕. The pointer over a
// popup (or the focus on its ✕) holds it; Esc closes every popup and takes the key first; a click elsewhere closes one
// that has been on screen for 2 s. One fact a line, the first line is the title. The newest is on top, a popup that
// changes its place slides there, and each fades in when it comes and out before it goes (index.css .notice).
// Differences: plain lines instead of translated words (this viewer is English only), the list comes as a prop.
// =========================================================================
import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clickCloses, moved, NOTICE_OK_MS, type Notice } from '../shared/notice';

export const NOTICE_FADE_MS = 300; // as long as the way out in index.css (.notice.out)

const keyOf = (n: Notice): string => `${n.at}:${n.lines.join('|')}`;

function Popup({ n, leaving, onLeave, onGone }: { n: Notice; leaving: boolean; onLeave: () => void; onGone: () => void }) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (n.level !== 'ok' || held || leaving) return undefined;
    const id = window.setTimeout(onLeave, NOTICE_OK_MS);
    return () => window.clearTimeout(id);
  }, [n, held, leaving, onLeave]);
  useEffect(() => {
    if (!leaving) return undefined;
    const id = window.setTimeout(onGone, NOTICE_FADE_MS);
    return () => window.clearTimeout(id);
  }, [leaving, onGone]);
  const box = useRef<HTMLDivElement>(null);
  const shownAt = useRef(Date.now());
  useEffect(() => {
    const onDown = (e: Event) => { if (clickCloses(!!box.current && e.target instanceof Node && box.current.contains(e.target), Date.now() - shownAt.current)) onLeave(); };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onLeave]);
  const error = n.level === 'error';
  return (
    <div ref={box} role={error ? 'alert' : 'status'} data-notice={n.level} data-leaving={leaving || undefined} data-held={held || undefined}
      onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}
      className={`notice ${error ? 'error' : 'ok'} ${leaving ? 'out' : ''}`}>
      <span aria-hidden className="notice-dot" />
      <span className="notice-lines" data-notice-lines>
        {n.lines.map((line, i) => <span key={i} className={i === 0 ? 'notice-title' : 'notice-line'}>{line}</span>)}
      </span>
      <button type="button" className="notice-close" title="Close" aria-label="Close" onClick={onLeave}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

// one popup with its own stable "leave" (the list's, bound to its key), so its timers do not restart on every draw
function Item({ n, leaving, leave, close, slot }: { n: Notice; leaving: boolean; leave: (key: string) => void; close: (n: Notice) => void; slot: (key: string, el: HTMLElement | null) => void }) {
  const key = keyOf(n);
  const onLeave = useCallback(() => leave(key), [leave, key]);
  const onGone = useCallback(() => close(n), [close, n]);
  const ref = useCallback((el: HTMLDivElement | null) => slot(key, el), [slot, key]);
  return <div ref={ref} data-notice-slot><Popup n={n} leaving={leaving} onLeave={onLeave} onGone={onGone} /></div>;
}

/** `list`: oldest first (pushNotice); `onClose` takes a popup out of it once it has faded. */
export function Notices({ list, onClose }: { list: readonly Notice[]; onClose: (n: Notice) => void }) {
  const [gone, setGone] = useState<readonly string[]>([]); // the popups on their way out, by key
  const leave = useCallback((key: string) => setGone((g) => (g.indexOf(key) >= 0 ? g : g.concat(key))), []);
  useEffect(() => { setGone((g) => { const kept = g.filter((k) => list.some((n) => keyOf(n) === k)); return kept.length === g.length ? g : kept; }); }, [list]);
  const live = useRef<string[]>([]);
  live.current = list.map(keyOf).filter((k) => gone.indexOf(k) < 0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !live.current.length) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      live.current.forEach(leave);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [leave]);
  // a popup that changes its place slides there: the earlier ones glide down when a new one comes on top
  const slots = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const now = new Map<string, number>();
    slots.current.forEach((el, key) => now.set(key, el.getBoundingClientRect().top));
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still) moved(tops.current, now).forEach(({ key, from }) => {
      const el = slots.current.get(key);
      if (el && typeof el.animate === 'function') el.animate([{ transform: `translateY(${from}px)` }, { transform: 'none' }], { duration: NOTICE_FADE_MS, easing: 'ease-out' });
    });
    tops.current = now;
  }, [list]);
  const slot = useCallback((key: string, el: HTMLElement | null) => { if (el) slots.current.set(key, el); else slots.current.delete(key); }, []);
  if (!list.length) return null;
  return (
    <div className="notices" data-notices>
      {list.slice().reverse().map((n) => <Item key={keyOf(n)} n={n} leaving={gone.indexOf(keyOf(n)) >= 0} leave={leave} close={onClose} slot={slot} />)}
    </div>
  );
}
