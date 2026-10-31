/// <reference lib="esnext" />
// =========================================================================
// X Feed Sheets: the viewer of daggerok/twitter (GitHub Pages, no backend), the daggerok/youtube shell.
//
// - Sticky toolbar: the 𝕏 mark, the handle input (Enter or ➕ adds an account), borderless icon buttons:
//   ⚙️ settings (slides open), status dots (userscript, Google) that toggle the log, ☁️ connect / 🔌 disconnect,
//   ↻ reload every account from the sheet, 📥 CSV, 📄 Import JSON, 🌙 / ☀ theme
// - Settings: Google OAuth Client ID and the spreadsheet (masked with dots, eye and copy buttons like youtube),
//   Connected as d••••k@gmail.com, Create spreadsheet, Find accounts in the sheet, Install userscript, setup steps.
//   Client ID and spreadsheet id stay in localStorage, the Google token only in memory (src/gis.ts)
// - Accounts: one Google Sheet tab `X-<handle>` per account; ⬇ Sync new / 🔄 Full sync open the profile on x.com
//   with `#xsync=incremental|full`, the userscript scrolls it and leaves the posts in Tampermonkey storage; the same
//   userscript on this page hands them over (src/bridge.ts) and they are merged into the tab (mergePosts)
// - Feed: filters (account, type, dates, media, search, sort), cards, CSV and JSON export of the filtered view
// Same look as credit-cards-reports (Tailwind 4, slate palette); every localStorage access in try/catch.
// =========================================================================
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { byNewest, mergePosts, sameHandle, type Media, type Post } from '../shared/post';
import { ackBatches, connectBridge, sendMeta, type Batch, type Run, type Status } from './bridge';
import { applyTable, COLS, EMPTY_TABLE, formatCount, hasFilters, linkify, MEDIA_KINDS, postsFromJson, toCsv, youtubeId, youtubeLinks, type ColKey, type MediaKind, type TableState } from './filters';
import { isDark, isNight, isThemeMode, nextMode, themeIcon, themeTitle, type ThemeMode } from './theme';
import { fetchEmail, GoogleSession } from './gis';
import type { GoogleCreds } from '../shared/post';
import { maskEmail, maskId, maskSpreadsheetUrl } from './mask';
import { createSpreadsheet, ensureTab, handleOfTab, listTabs, readPosts, spreadsheetId, spreadsheetUrl, tabOf, writePostRow, writePosts } from './sheets';

// ---- 1. Storage (config, accounts, a copy of the posts; the view) -------------------------------------

const PREFIX = 'twitter';
const THEME_KEY = `${PREFIX}-theme`;
const CONFIG_KEY = `${PREFIX}-gs-config`;
const FILTERS_KEY = `${PREFIX}-filters`;
const CURRENT_KEY = `${PREFIX}-current`;
const SCALE_KEY = `${PREFIX}-scale`;
const DEFAULT_SCALE_SLIDER = 50;
const sliderToScale = (v: number): number => 0.7 + (v / 100) * 0.8;
const postsKey = (handle: string) => `${PREFIX}-posts-${handle.toLowerCase()}`;
const PAGE_SIZE = 50;
const USERSCRIPT_URL = './x-sync.user.js';
const REPO_URL = 'https://github.com/daggerok/twitter';

type Config = { clientId: string; spreadsheetId: string; lastAccountEmail: string; withReplies: boolean };
const EMPTY_CONFIG: Config = { clientId: '', spreadsheetId: '', lastAccountEmail: '', withReplies: false };

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota or private mode */ }
}
function lsDel(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
function lsJson<T>(key: string, fallback: T): T {
  try { const raw = lsGet(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}

const loadConfig = (): Config => ({ ...EMPTY_CONFIG, ...lsJson<Partial<Config>>(CONFIG_KEY, {}) });
const loadCachedPosts = (handle: string): Post[] => lsJson<Post[]>(postsKey(handle), []);
const cachePosts = (handle: string, posts: Post[]): void => lsSet(postsKey(handle), JSON.stringify(posts));

const cleanHandle = (s: string): string => s.trim().replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//i, '').split(/[/?#]/)[0];
const isHandle = (s: string): boolean => /^[A-Za-z0-9_]{1,15}$/.test(s);
const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const fmtDate = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : iso || '—';
};
const newestIdOf = (posts: Post[]): string => {
  const p = posts.filter((x) => !x.is_pinned).sort(byNewest)[0];
  return p ? p.id : '';
};

function download(name: string, text: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// ---- 2. App (one account at a time, like one channel in youtube) --------------------------------------

type LogLine = { ts: string; msg: string };

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => { const v = lsGet(THEME_KEY); return isThemeMode(v) ? v : 'light'; });
  const [night, setNight] = useState(() => isNight());
  const dark = isDark(themeMode, night);
  const [cfg, setCfg] = useState<Config>(loadConfig);
  const [showSettings, setShowSettings] = useState(() => !loadConfig().clientId);
  const [showLog, setShowLog] = useState(false);
  const [current, setCurrent] = useState(() => lsGet(CURRENT_KEY) || '');
  const [handle, setHandle] = useState(() => cleanHandle(lsGet(CURRENT_KEY) || ''));
  const [posts, setPosts] = useState<Post[]>(() => loadCachedPosts(cleanHandle(lsGet(CURRENT_KEY) || '')));
  const [fromSheet, setFromSheet] = useState(false);
  const [table, setTable] = useState<TableState>(() => {
    const t = lsJson<Partial<TableState>>(FILTERS_KEY, {});
    const filters = { ...EMPTY_TABLE.filters };
    COLS.forEach((c) => { const v = t.filters && typeof t.filters[c] === 'string' ? t.filters[c] : ''; filters[c] = v; });
    const sort = t.sort && COLS.includes(t.sort.key) && (t.sort.dir === 'asc' || t.sort.dir === 'desc') ? t.sort : EMPTY_TABLE.sort;
    const media = Array.isArray(t.media) ? t.media.filter((k): k is MediaKind => MEDIA_KINDS.some((m) => m.key === k)) : [];
    return { filters, sort, media };
  });
  const [shown, setShown] = useState(PAGE_SIZE);
  const [scaleSlider, setScaleSlider] = useState(() => { const n = Number(lsGet(SCALE_KEY)); return Number.isFinite(n) && lsGet(SCALE_KEY) !== null ? Math.min(100, Math.max(0, n)) : DEFAULT_SCALE_SLIDER; });
  const scale = sliderToScale(scaleSlider);
  const [email, setEmail] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [log, setLog] = useState<LogLine[]>([]);
  const [scriptVersion, setScriptVersion] = useState('');
  const [stamp, setStamp] = useState(''); // the DOM mark the userscript leaves even when its messages do not arrive
  const [settled, setSettled] = useState(false); // 2.5 s after load: only then a missing hello is worth a hint
  const [outbox, setOutbox] = useState<Batch[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runStatus, setRunStatus] = useState<Status>(null);
  const [sheetTitle, setSheetTitle] = useState('');
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const handleRef = useRef(handle);
  handleRef.current = handle;
  const session = useRef(new GoogleSession(() => cfgRef.current.clientId));
  const storing = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sentinel = useRef<HTMLTableRowElement>(null);

  const say = useCallback((msg: string) => {
    setLog((l) => [{ ts: new Date().toLocaleTimeString(), msg }, ...l].slice(0, 200));
  }, []);

  useEffect(() => { lsSet(THEME_KEY, themeMode); }, [themeMode]);
  useEffect(() => { if (themeMode !== 'auto') return undefined; const tick = () => setNight(isNight()); tick(); const t = window.setInterval(tick, 60_000); return () => window.clearInterval(t); }, [themeMode]);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); document.documentElement.style.backgroundColor = dark ? '#020617' : '#f8fafc'; }, [dark]);
  useEffect(() => { lsSet(CONFIG_KEY, JSON.stringify(cfg)); }, [cfg]);
  useEffect(() => { lsSet(CURRENT_KEY, current); }, [current]);
  useEffect(() => { lsSet(SCALE_KEY, String(scaleSlider)); }, [scaleSlider]);
  useEffect(() => { lsSet(FILTERS_KEY, JSON.stringify(table)); setShown(PAGE_SIZE); }, [table]);

  const sid = spreadsheetId(cfg.spreadsheetId);
  const isBusy = !!busy;

  // the Google token, its expiry and the spreadsheet id go to the userscript through a DOM attribute of this page
  // (the script polls it and keeps it in Tampermonkey storage, so the x.com side writes the sheet directly)
  useEffect(() => {
    const share = () => {
      const t = session.current.peek();
      const id = spreadsheetId(cfgRef.current.spreadsheetId);
      const creds: GoogleCreds | null = t && id ? { token: t.value, expiresAt: t.expiresAt, spreadsheetId: id, email: cfgRef.current.lastAccountEmail } : null;
      const next = creds ? JSON.stringify(creds) : '';
      if (document.documentElement.dataset.xsyncGoogle !== next) document.documentElement.dataset.xsyncGoogle = next;
    };
    share();
    const timer = window.setInterval(share, 3000);
    return () => window.clearInterval(timer);
  }, [connected, cfg.spreadsheetId]);

  // ---- Google ----
  const connect = useCallback(async (interactive: boolean) => {
    try {
      setBusy('Connecting to Google…');
      const token = await session.current.get(interactive, interactive);
      setConnected(true);
      try {
        const mail = await fetchEmail(token);
        setEmail(mail);
        if (mail) setCfg((c) => ({ ...c, lastAccountEmail: mail }));
      } catch { setEmail(cfgRef.current.lastAccountEmail); }
      say(interactive ? '✅ Connected to Google' : '✅ Google session renewed');
      setError('');
      return true;
    } catch (e) {
      setConnected(false);
      if (interactive) setError(`Google sign-in failed: ${errorText(e)}`);
      say(`❌ Google auth: ${errorText(e)}`);
      return false;
    } finally {
      setBusy('');
    }
  }, [say]);

  const disconnect = useCallback(() => {
    session.current.disconnect();
    setConnected(false);
    setEmail('');
    setCfg((c) => ({ ...c, lastAccountEmail: '' }));
    say('🔌 Disconnected from Google');
  }, [say]);

  // zero-click: a browser that was connected before renews the token silently on load
  useEffect(() => {
    if (cfg.clientId && cfg.lastAccountEmail && !connected && !session.current.disabled) void connect(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withSheet = useCallback(async <T,>(label: string, op: (token: string, id: string) => Promise<T>): Promise<T | null> => {
    const id = spreadsheetId(cfgRef.current.spreadsheetId);
    if (!id) { setError('Paste the spreadsheet url in Setup first'); setShowSettings(true); return null; }
    setBusy(label);
    try {
      const r = await session.current.run((token) => op(token, id));
      setConnected(true);
      setError('');
      return r;
    } catch (e) {
      setError(`${label}: ${errorText(e)}`);
      say(`❌ ${label}: ${errorText(e)}`);
      return null;
    } finally {
      setBusy('');
    }
  }, [say]);

  /** Posts of an account after a read or a write: cached, shown when it is the current one, newest id to the userscript. */
  const publish = useCallback((h: string, list: Post[], sheet: boolean) => {
    cachePosts(h, list);
    sendMeta(h, newestIdOf(list), list.length);
    if (sameHandle(h, handleRef.current)) { setPosts(list); setFromSheet(sheet); }
  }, []);

  /** The handle in the toolbar field; an invalid one shows an error and gives null. */
  const readField = useCallback((): string | null => {
    const h = cleanHandle(current);
    if (!isHandle(h)) { setError('Type an X profile link or @handle (1 to 15 letters, digits or _)'); return null; }
    if (!sameHandle(h, handleRef.current)) {
      handleRef.current = h;
      setHandle(h);
      setPosts(loadCachedPosts(h));
      setFromSheet(false);
    }
    return h;
  }, [current]);

  const loadFromSheet = useCallback(async (h: string, quiet = false): Promise<Post[] | null> => {
    const list = await withSheet(`Loading @${h}`, async (token, id) => {
      const tab = await ensureTab(token, id, tabOf(h));
      return readPosts(token, id, tab);
    });
    if (list) {
      publish(h, list, true);
      if (!quiet) say(`☁️ Loaded ${list.length} posts of @${h} from tab ${tabOf(h)}`);
    }
    return list;
  }, [withSheet, publish, say]);

  /** Enter or ↻: show the stored posts of the handle in the field. */
  const load = useCallback(async () => {
    const h = readField();
    if (!h) return;
    if (connected && sid) await loadFromSheet(h);
    else say(`💾 @${h}: ${loadCachedPosts(h).length} posts from the local copy (connect Google for the sheet)`);
  }, [readField, connected, sid, loadFromSheet, say]);

  /** Captured posts (userscript batches or a JSON import) merged into the tab of their account. */
  const storePosts = useCallback(async (h: string, captured: Post[]): Promise<boolean> => {
    const r = await withSheet(`Storing ${captured.length} posts of @${h}`, async (token, id) => {
      const tab = await ensureTab(token, id, tabOf(h));
      const stored = await readPosts(token, id, tab);
      const merged = mergePosts(stored, captured);
      await writePosts(token, id, tab, merged.posts);
      return merged;
    });
    if (!r) return false;
    publish(h, r.posts, true);
    say(`☁️ @${h}: ${r.inserted} new, ${r.updated} updated, ${r.posts.length} in tab ${tabOf(h)}`);
    return true;
  }, [withSheet, publish, say]);

  useEffect(() => { const t = window.setTimeout(() => setSettled(true), 2500); return () => window.clearTimeout(t); }, []);
  useEffect(() => {
    const read = () => setStamp(document.documentElement.dataset.xsync || '');
    read();
    const t = window.setInterval(read, 1000);
    return () => window.clearInterval(t);
  }, []);

  // ---- userscript bridge ----
  useEffect(() => connectBridge({
    hello: (v) => { setScriptVersion(v); },
    outbox: (b) => setOutbox(b),
    runs: (r) => setRuns(r),
    status: (s) => setRunStatus(s),
  }), []);

  const storeOutbox = useCallback(async () => {
    if (storing.current || !outbox.length) return;
    storing.current = true;
    try {
      const byHandle = new Map<string, { ids: string[]; posts: Post[] }>();
      outbox.forEach((b) => {
        const g = byHandle.get(b.handle) || { ids: [], posts: [] };
        g.ids.push(b.id);
        g.posts.push(...b.posts);
        byHandle.set(b.handle, g);
      });
      const entries = Array.from(byHandle.entries());
      for (let i = 0; i < entries.length; i += 1) {
        const [h, g] = entries[i];
        const ok = await storePosts(h, g.posts);
        if (!ok) break;
        ackBatches(g.ids);
      }
    } finally {
      storing.current = false;
    }
  }, [outbox, storePosts]);

  const seenRun = useRef('');
  useEffect(() => {
    const last = runs.filter((r) => r.handle === handleRef.current && r.finished_at).sort((a, b) => (a.finished_at < b.finished_at ? 1 : -1))[0];
    if (!last || last.run_id === seenRun.current) return;
    seenRun.current = last.run_id;
    if (connected && sid && last.stored_in_sheet) void loadFromSheet(handleRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs]);

  const outboxCount = outbox.reduce((n, b) => n + b.posts.length, 0);
  const canStore = connected && !!sid && !session.current.disabled;
  useEffect(() => {
    if (outboxCount && canStore) void storeOutbox();
  }, [outboxCount, canStore, storeOutbox]);

  // after a connect, the current account comes from its tab
  useEffect(() => {
    if (connected && sid && handle && !fromSheet) void loadFromSheet(handle, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, sid]);

  // ---- sync ----
  const openSync = useCallback((mode: 'incremental' | 'full') => {
    const h = readField();
    if (!h) return;
    const list = h === handleRef.current ? posts : loadCachedPosts(h);
    sendMeta(h, newestIdOf(list), list.length);
    const path = cfg.withReplies ? `/${h}/with_replies` : `/${h}`;
    say(`${mode === 'full' ? '🔄 Full sync' : '⬇ Sync new'} of @${h}: the profile opens on x.com, the badge there scrolls it`);
    window.open(`https://x.com${path}#xsync=${mode}`, '_blank', 'noopener');
  }, [readField, posts, cfg.withReplies, say]);

  const createSheet = useCallback(async () => {
    try {
      setBusy('Creating the spreadsheet…');
      const token = await session.current.get(true, true);
      setConnected(true);
      const r = await createSpreadsheet(token, 'X Feed Sheets');
      setCfg((c) => ({ ...c, spreadsheetId: r.id }));
      say(`📄 Created ${r.url}`);
      setError('');
    } catch (e) {
      setError(`Create spreadsheet: ${errorText(e)}`);
    } finally {
      setBusy('');
    }
  }, [say]);

  const listSheet = useCallback(async () => {
    const r = await withSheet('Reading the spreadsheet', (token, id) => listTabs(token, id));
    if (!r) return;
    setSheetTitle(r.title);
    const found = r.tabs.map((t) => handleOfTab(t.title)).filter((h): h is string => !!h && isHandle(h));
    say(`📄 "${r.title}": ${r.tabs.length} tabs, accounts: ${found.length ? found.map((h) => `@${h}`).join(', ') : 'none yet'}`);
  }, [withSheet, say]);

  const importJson = useCallback(async (file: File) => {
    try {
      const list = postsFromJson(await file.text());
      if (!list.length) { setError('No posts in that file'); return; }
      const byHandle = new Map<string, Post[]>();
      list.forEach((p) => byHandle.set(p.handle, [...(byHandle.get(p.handle) || []), p]));
      const entries = Array.from(byHandle.entries());
      for (let i = 0; i < entries.length; i += 1) {
        const [h, items] = entries[i];
        if (canStore) await storePosts(h, items);
        else {
          const merged = mergePosts(loadCachedPosts(h), items);
          publish(h, merged.posts, false);
          say(`💾 @${h}: ${merged.inserted} new kept locally (connect Google to store them)`);
        }
      }
      const first = entries[0][0];
      if (!handleRef.current) { setCurrent(`https://x.com/${first}`); handleRef.current = first; setHandle(first); setPosts(loadCachedPosts(first)); }
    } catch (e) {
      setError(`Import: ${errorText(e)}`);
    }
  }, [canStore, storePosts, publish, say]);

  /** The crossed eye: hide a post from the feed (or bring it back); its row is rewritten in the sheet, the rest untouched. */
  const toggleHidden = useCallback(async (post: Post) => {
    const next = { ...post, hidden: !post.hidden };
    const list = posts.map((p) => (p.id === post.id ? next : p));
    setPosts(list);
    cachePosts(handleRef.current, list);
    if (!connected || !sid) { say(`${next.hidden ? '🙈 Hidden' : '👁 Visible again'} locally: connect Google to keep it in the sheet`); return; }
    const ok = await withSheet(`${next.hidden ? 'Hiding' : 'Showing'} post ${post.id}`, async (token, id) => { const tab = await ensureTab(token, id, tabOf(handleRef.current)); await writePostRow(token, id, tab, next); return true; });
    if (ok) say(`${next.hidden ? '🙈 Hidden' : '👁 Visible again'}: ${post.url}`);
  }, [posts, connected, sid, withSheet, say]);

  // ---- feed (column filters and sorting, the youtube table) ----
  const feed = useMemo(() => applyTable(posts, table, fmtDate), [posts, table]);
  const setFilter = (c: ColKey, v: string) => setTable((t) => ({ ...t, filters: { ...t.filters, [c]: v } }));
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [ddAt, setDdAt] = useState<{ x: number; y: number } | null>(null); // the media dropdown is fixed-positioned: the table wrapper would clip it
  const ddRef = useRef<HTMLDetailsElement>(null);
  // a click anywhere else, or Escape, closes the media dropdown
  useEffect(() => {
    if (!ddAt) return undefined;
    const away = (e: MouseEvent) => { const el = ddRef.current; if (el && e.target instanceof Node && !el.contains(e.target)) el.open = false; };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && ddRef.current) ddRef.current.open = false; };
    document.addEventListener('mousedown', away, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away, true); document.removeEventListener('keydown', esc); };
  }, [ddAt]);
  const toggleMedia = (k: MediaKind) => setTable((t) => ({ ...t, media: t.media.includes(k) ? t.media.filter((x) => x !== k) : [...t.media, k] }));
  const sortBy = (c: ColKey) => setTable((t) => ({ ...t, sort: { key: c, dir: t.sort.key === c && t.sort.dir === 'desc' ? 'asc' : 'desc' } }));
  const visible = feed.slice(0, shown);
  // infinite scroll: the next 50 cards mount when the middle of the last page comes near the viewport, so the end is never reached
  const sentinelAt = Math.max(0, visible.length - Math.ceil(PAGE_SIZE / 2)) - 1;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || feed.length <= shown) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((s) => Math.min(s + PAGE_SIZE, feed.length));
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [feed.length, shown]);
  const lastRun = runs.filter((r) => r.handle === handle).sort((a, b) => (a.finished_at < b.finished_at ? 1 : -1))[0];
  const exportCsv = () => download(`x-${handle || 'feed'}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(feed), 'text/csv');
  const exportJson = () => download(`x-${handle || 'feed'}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ posts: feed }, null, 2), 'application/json');

  return (
    <div className="h-dvh flex flex-col">
      {/* toolbar, the youtube one: field, settings, status dots, update, full refresh, cloud, attach, export, theme */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="px-4">
          <div className="flex flex-col md:flex-row md:items-center gap-2 py-4">
            <div className="flex items-center gap-2 w-full md:flex-1 min-w-0">
              <form className="flex-1 min-w-0" onSubmit={(e) => { e.preventDefault(); void load(); }}>
                <input className="inp mono" title="X profile link or @handle, Enter loads its stored posts" placeholder="X profile link or @handle (https://x.com/elonmusk)…" value={current} onChange={(e) => setCurrent(e.target.value)} />
              </form>
            </div>
            <div className="grid grid-flow-col auto-cols-fr justify-items-center gap-1.5 w-full md:flex md:w-auto">
              <button className={`tb ${showSettings ? 'on' : ''}`} title="Settings" onClick={() => setShowSettings((s) => !s)}>⚙️</button>
              <button className={`tb ${showLog ? 'on' : ''}`} title={`Log (${log.length}). Dots: userscript ${scriptVersion ? `v${scriptVersion} installed` : 'not installed in this browser'}, Google Sheets ${connected ? `connected${email ? ` as ${maskEmail(email)}` : ''}` : 'not connected'}`} onClick={() => setShowLog((s) => !s)}>
                <span className="flex items-center gap-1">
                  <span className={`dot ${scriptVersion ? 'bg-emerald-500' : 'bg-red-500'}`} data-script={scriptVersion || 'none'} />
                  <span className={`dot ${connected && sid ? 'bg-blue-500' : 'bg-slate-400'}`} data-google={connected ? 'on' : 'off'} />
                </span>
              </button>
              <button className="tb blue font-bold" title="Update: sync the new posts of this profile (opens x.com)" onClick={() => openSync('incremental')} disabled={!current.trim()}>⬇</button>
              <button className="tb" title="Full refresh: sync the whole visible timeline again (opens x.com)" onClick={() => openSync('full')} disabled={!current.trim()}>🔄</button>
              {/* every button is always there (no toolbar jumps): disabled when it makes no sense right now */}
              <button className="tb blue" title={cfg.clientId ? (connected ? 'Google Sheets connected' : 'Connect Google Sheets') : 'Connect Google Sheets (paste the Client ID in Settings first)'} onClick={() => { void connect(true); }} disabled={isBusy || connected || !cfg.clientId}>☁️</button>
              <button className="tb rose" title={connected ? 'Disconnect Google' : 'Disconnect Google (not connected)'} onClick={disconnect} disabled={isBusy || !connected}>🔌</button>
              <button className="tb green" title={connected && sid ? 'Ensure the tab and reload the posts from Google Sheets' : 'Ensure the tab and reload the posts from Google Sheets (connect Google and set the spreadsheet first)'} onClick={() => { void load(); }} disabled={isBusy || !connected || !sid || !current.trim()}>↻</button>
              <button className="tb green flex-col leading-none" title="Export CSV of the filtered feed" onClick={exportCsv} disabled={!feed.length}>📥<span className="text-[8px] font-bold tracking-wide">CSV</span></button>
              <button className="tb green flex-col leading-none" title="Export JSON of the filtered feed" onClick={exportJson} disabled={!feed.length}>📥<span className="text-[8px] font-bold tracking-wide">JSON</span></button>
              <button className={`tb theme ${dark ? 'sun' : ''}`} title={themeTitle(themeMode, night)} onClick={() => setThemeMode((m) => nextMode(m))} data-theme-mode={themeMode}>
                <span className="relative inline-flex">{themeIcon(themeMode, night).icon}{themeIcon(themeMode, night).auto && <span className="absolute -top-1.5 -right-2 text-[8px] font-bold leading-none" data-auto>A</span>}</span>
              </button>
            </div>
          </div>

          {/* log console, slides open */}
          <div id="log-wrap" className={`slide-wrap ${showLog ? 'open' : ''}`}>
            <div className="slide-inner">
              <div className="pb-4">
                <div className="card overflow-hidden text-xs">
                  <div className="panel-head text-[11px]">
                    <div className="font-semibold text-emerald-500">🐛 Debug Console <span className="font-normal text-slate-400">({log.length})</span></div>
                    <button className="btn sm" onClick={() => setLog([])}>Clear</button>
                  </div>
                  {log.length ? (
                    <div className="max-h-44 overflow-auto themed-scroll p-1">
                      <table className="w-full font-mono text-[11px]">
                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/40">
                          {log.map((l, i) => (
                            <tr key={i}>
                              <td className="px-2 py-1 text-slate-400 tabular-nums w-8">{log.length - i}</td>
                              <td className={`px-2 py-1 ${l.msg.startsWith('❌') ? 'text-rose-500' : l.msg.startsWith('✅') || l.msg.startsWith('☁️') ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{l.msg}</td>
                              <td className="px-2 py-1 text-right text-[10px] text-slate-400 tabular-nums w-24">{l.ts}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="px-3 py-2 text-slate-400">Nothing yet</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-4 overflow-y-auto themed-scroll">
        {error && (
          <div className="card status-bad mb-4 px-3 py-2 text-sm flex justify-between gap-2 animate-fade-in">
            <span className="break-words">{error}</span>
            <button className="font-bold" onClick={() => setError('')} aria-label="Dismiss">×</button>
          </div>
        )}
        {settled && !scriptVersion && !stamp && (
          <div className="card status-warn mb-4 px-3 py-2 text-sm animate-fade-in" data-hint="no-script">
            <b>The userscript is not running on this page</b> (first dot red), so posts collected on x.com cannot reach the sheet. Check: click the Tampermonkey icon in the Chrome toolbar while on this page; it must list "X -&gt; Google Sheets sync" as running here. If it does not: chrome://extensions, Tampermonkey, Details, Site access, add <code className="px-1">https://daggerok.github.io/*</code> next to x.com; then install <a className="underline" href={USERSCRIPT_URL}>x-sync.user.js</a> if not yet, and reload this page. The dot turns green when it works.
          </div>
        )}
        {settled && !scriptVersion && stamp && (
          <div className="card status-bad mb-4 px-3 py-2 text-sm animate-fade-in" data-hint="bridge">
            <b>The userscript v{stamp} runs on this page but its messages do not arrive</b> (first dot red). Reload the page once; if it stays red, open the browser console (F12, Console) on this page and send its lines to the repo issues.
          </div>
        )}

        {/* settings, slides open */}
        <div id="settings-wrap" className={`slide-wrap shrink-0 ${showSettings ? 'open mb-4' : ''}`}>
          <div className="slide-inner">
            <Settings
              cfg={cfg} setCfg={setCfg} connected={connected} email={email || cfg.lastAccountEmail} busy={isBusy} sheetTitle={sheetTitle} handle={handle}
              onClose={() => setShowSettings(false)} onConnect={() => { void connect(true); }} onDisconnect={disconnect}
              onCreate={() => { void createSheet(); }} onList={() => { void listSheet(); }} onImport={() => fileInput.current?.click()} onExport={exportJson}
            />
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ''; }} />
          </div>
        </div>

        {/* inbox from the userscript */}
        {(outboxCount > 0 || runStatus?.state === 'running') && (
          <section className="card mb-4 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2 animate-fade-in">
            <div>
              {runStatus?.state === 'running' && <div>⏳ Syncing @{runStatus.handle} ({runStatus.mode}): {runStatus.seen} posts so far{runStatus.message ? ` · ${runStatus.message}` : ''}</div>}
              {outboxCount > 0 && <div>📥 {outboxCount} captured posts waiting{canStore ? ', storing…' : ' (connect Google and set the spreadsheet to store them)'}</div>}
            </div>
            {outboxCount > 0 && !canStore && <button className="btn sm primary" onClick={() => { void connect(true); }}>Connect Google</button>}
          </section>
        )}

        {/* feed of the current account */}
        <section className="card overflow-hidden shadow-lg feed flex-1 min-h-64 flex flex-col">
          <div className="panel-head">
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-2">
              <h3 className="font-bold text-emerald-500" style={{ fontSize: `${Math.round(16 * scale)}px` }}>
                {feed.length} / {posts.length}
              </h3>
              {busy && <span className="text-[10px] text-slate-500 dark:text-slate-400 animate-pulse" data-busy>⏳ {busy}</span>}
              {handle && (
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {fromSheet ? <>☁️ Synced to Google Sheets • tab: <span className="font-mono">{tabOf(handle)}</span></> : posts.length ? '💾 local copy' : '—'}{lastRun ? ` • last sync ${fmtDate(lastRun.finished_at)}: ${lastRun.posts_seen} seen, ${lastRun.stop_reason.replace(/_/g, ' ')}` : ''}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {hasFilters(table) && <button className="btn sm" onClick={() => setTable((t) => ({ ...t, filters: { ...EMPTY_TABLE.filters }, media: [] }))} data-clear-filters>Clear filters</button>}
              <span className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">A</span>
                <input type="range" min="0" max="100" value={scaleSlider} onChange={(e) => setScaleSlider(Number(e.target.value))} className="scale-slider w-20" title={`Scale: ${Math.round(scale * 100)}%`} />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">A</span>
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col p-4 space-y-4">
          {(
            <div className="flex-1 min-h-0 overflow-auto themed-scroll -mx-4">
              <table className="w-full text-left border-collapse" style={{ fontSize: `${Math.round(14 * scale)}px` }}>
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400">
                    {([['datetime', 'Datetime', 'w-44', 'e.g. 10/16/2022, 2022*15:00'], ['type', 'Type', 'w-28', 'post|reply|repost|quote, pinned'], ['media', 'Media', 'w-44', 'photo, video, gif, youtube, media, text only'], ['post', 'Post', '', 'words in order: a*b, either: a|b'], ['stats', 'Stats', 'w-44 hidden lg:table-cell', ''], ['url', 'URL', 'w-24', 'part of the link, e.g. status/17 or x.com/name'], ['hidden', 'Hidden', 'w-24', 'hidden or visible']] as [string, string, string, string][]).map(([key, label, w, hint]) => {
                      const col = COLS.includes(key as ColKey) ? (key as ColKey) : null;
                      const active = col && table.sort.key === col;
                      return (
                        <th key={key} className={`px-4 align-top sticky top-0 ${key === 'media' && ddAt ? 'z-30' : 'z-20'} bg-white dark:bg-slate-800 shadow-[inset_0_-1px_0_#e2e8f0] dark:shadow-[inset_0_-1px_0_rgba(71,85,105,.6)] ${w}`} style={{ fontSize: `${Math.round(11 * scale)}px`, paddingTop: `${Math.round(10 * scale)}px`, paddingBottom: `${Math.round(10 * scale)}px` }}>
                          {col ? (
                            <button type="button" className={`flex items-center gap-1 font-semibold uppercase tracking-wider text-left transition-colors hover:text-emerald-500 ${active ? 'text-emerald-500' : ''}`} onClick={() => sortBy(col)} title={`Sort by ${label}`} data-sort={active ? table.sort.dir : 'none'}>
                              {label} <span className="text-[10px]">{active ? (table.sort.dir === 'desc' ? '▼' : '▲') : '↕'}</span>
                            </button>
                          ) : <span className="font-semibold uppercase tracking-wider">{label}</span>}
                          {col && (
                            <div className="mt-1.5 flex items-center gap-1">
                              <input className="filter-inp" placeholder="Filter…" title={hint ? `${hint}. AND: a*b or a&b (in order), OR: a|b, no quotes, spaces count` : undefined} value={table.filters[col]} onChange={(e) => setFilter(col, e.target.value)} data-filter={col} />
                              {col === 'media' && (
                                <details ref={ddRef} className="setup inline-block ml-1 align-middle" data-media-dd onToggle={(e) => { const el = e.currentTarget; if (el.open) { const r = el.getBoundingClientRect(); setDdAt({ x: r.left, y: r.bottom + 4 }); } else setDdAt(null); }}>
                                  <summary className={`ib dd normal-case tracking-normal font-normal ${table.media.length ? 'text-emerald-600 dark:text-emerald-400 border-emerald-400' : ''}`} title="Media: tick what the post must have (Photo, Video, GIF, Media = any) or must not have (the ! twins); nothing ticked = every post">🖼{table.media.length ? ` ` : ''} ▾</summary>
                                  <div className="fixed z-50 card p-2 shadow-xl min-w-52 space-y-1 normal-case tracking-normal font-normal" style={{ left: ddAt?.x ?? 0, top: ddAt?.y ?? 0, fontSize: `${Math.round(12 * scale)}px` }}>
                                    {MEDIA_KINDS.map((m) => (
                                      <label key={m.key} className="flex items-center gap-2 cursor-pointer whitespace-nowrap"><input type="checkbox" checked={table.media.includes(m.key)} onChange={() => toggleMedia(m.key)} data-media-kind={m.key} /> {m.label}</label>
                                    ))}
                                    <button type="button" className="btn sm w-full justify-center" onClick={() => setTable((t) => ({ ...t, media: [] }))} disabled={!table.media.length}>All</button>
                                  </div>
                                </details>
                              )}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                  {visible.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400" data-empty>
                      {!handle ? 'Type an X profile link or @handle in the field above, then ⬇ to sync its posts (or Enter to show what the sheet already has).' : posts.length ? 'Nothing matches these filters.' : `No posts of @${handle} yet: press ⬇ to sync them from x.com.`}
                    </td></tr>
                  )}
                  {visible.map((p, i) => (
                    <PostRow key={p.id} post={p} scale={scale} onOpenMedia={(items, index) => setLightbox({ items, index })} onToggleHidden={() => { void toggleHidden(p); }} sentinel={i === sentinelAt && feed.length > shown ? sentinel : undefined} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {feed.length > shown && <div className="text-center text-xs text-slate-400 py-2" data-more={feed.length - shown}>{feed.length - shown} more below…</div>}
          </div>
        </section>
      </div>

      {lightbox && <Lightbox items={lightbox.items} index={lightbox.index} onIndex={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))} onClose={() => setLightbox(null)} />}
      <footer className="flex h-4 shrink-0 items-center justify-center px-4 text-[10px] leading-none text-slate-500 dark:text-slate-400">
        <a className="transition-colors hover:text-slate-600 dark:hover:text-slate-200" href={REPO_URL} target="_blank" rel="noreferrer">daggerok &copy; {new Date().getFullYear()}</a>
      </footer>
    </div>
  );
}

// ---- 3. Settings (masked values with eye and copy, like youtube) -----------------------------------------

type SettingsProps = {
  cfg: Config; setCfg: (f: (c: Config) => Config) => void; connected: boolean; email: string; busy: boolean; sheetTitle: string; handle: string;
  onClose: () => void; onConnect: () => void; onDisconnect: () => void; onCreate: () => void; onList: () => void; onImport: () => void; onExport: () => void;
};

function MaskedField(p: { label: string; value: string; mask: (v: string) => string; placeholder: string; onChange: (v: string) => void; hint?: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => { if (await copyText(p.value)) { setCopied(true); setTimeout(() => setCopied(false), 1200); } };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{p.label}</span>
        <div className="flex items-center gap-1">
          <button type="button" className="ib" title={show ? `Hide ${p.label}` : `Show ${p.label}`} onClick={() => setShow((s) => !s)}>{show ? '🙈' : '👁'}</button>
          <button type="button" className="ib" title={`Copy ${p.label}`} onClick={() => { void copy(); }} disabled={!p.value}>{copied ? '✅' : '📋'}</button>
        </div>
      </div>
      {show
        ? <input className="inp mono text-xs" value={p.value} onChange={(e) => p.onChange(e.target.value)} placeholder={p.placeholder} autoComplete="off" spellCheck={false} />
        : <input className="inp masked text-xs" value={p.value ? p.mask(p.value) : ''} onFocus={() => setShow(true)} onChange={() => { /* editing happens in the shown state */ }} placeholder={p.placeholder} readOnly />}
      {p.hint && <div className="text-[10px] text-slate-400 mt-1">{p.hint}</div>}
    </div>
  );
}

function Settings(p: SettingsProps) {
  const id = spreadsheetId(p.cfg.spreadsheetId);
  const [showEmail, setShowEmail] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const origin = location.origin;
  const url = id ? spreadsheetUrl(id) : '';
  return (
    <div className="card overflow-hidden text-sm shadow-lg">
      <div className="panel-head">
        <h3 className="font-bold text-emerald-500">📋 Setup</h3>
        <button className="btn sm" onClick={p.onClose}>Close</button>
      </div>
      <div className="p-4 space-y-4">
        <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
          <div><strong className="text-slate-700 dark:text-slate-200">What this is:</strong> x.com lets nobody read a timeline from outside, the posts exist only in your own logged-in browser. <b>Tampermonkey</b> is a Chrome extension that runs small programs (<b>userscripts</b>, one .user.js file each) on the sites you allow it. Our file x-sync.user.js scrolls a profile on x.com and remembers the posts; the same file, running on this page, hands them to this viewer, which writes them to your Google Sheet. Tampermonkey must therefore be allowed on <b>both</b> x.com and {location.hostname}: with x.com only, the install link shows raw code instead of the install page and the posts never reach the sheet.</div>
          <div><strong className="text-emerald-600 dark:text-emerald-400">Auto-load + cross-device:</strong> localStorage + your Google Sheet. Connect Google on any device and the same accounts and posts are there.</div>
          <div><strong className="text-blue-500">Per-account tabs:</strong> every X account gets its own tab (e.g. X-handle) inside one spreadsheet. The YT-… tabs of youtube can live in the same file.</div>
        </div>
        <details className="setup rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
          <summary className="px-4 py-3 text-sm font-semibold text-emerald-900 dark:text-emerald-200"><span className="chev">▸</span> Google Sheets and Tampermonkey setup (once)</summary>
          <ol className="list-decimal ml-8 mr-4 mb-4 space-y-1 text-xs text-emerald-900 dark:text-emerald-200">
            <li>Go to <a className="underline text-emerald-600 dark:text-emerald-400" href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">console.cloud.google.com</a>, enable the <b>Google Sheets API</b>, OAuth consent screen (External, your email under Test users), create an OAuth 2.0 Client ID of type Web application with the authorized JavaScript origins <code className="bg-emerald-100 dark:bg-emerald-800 px-1">{origin}</code> and <code className="bg-emerald-100 dark:bg-emerald-800 px-1">http://localhost:1234</code>. No secret is used</li>
            <li>Paste the Client ID below, press <b>Connect Google</b>, then <b>Create spreadsheet</b> or paste the url of an existing one</li>
            <li>Install <a className="underline" href="https://www.tampermonkey.net/" target="_blank" rel="noreferrer">Tampermonkey</a>; in Chrome 138+ open its extension details, turn on <b>Allow User Scripts</b> and give it site access to <b>x.com</b> and <b>{location.hostname}</b></li>
            <li>Open <a className="underline font-medium" href={USERSCRIPT_URL}>x-sync.user.js</a>: Tampermonkey shows its install page, press Install. Reload this page: the first dot in the toolbar turns green</li>
            <li>Type a profile link or handle in the top field, then ⬇: the profile opens on x.com (log in there first), the corner badge scrolls it; come back here and the posts are stored</li>
          </ol>
          <div className="px-4 pb-3 text-xs text-amber-700 dark:text-amber-300">Security: only the public Client ID and the spreadsheet id are stored in this browser, the Google token lives in memory. Posts go from your browser to your Google Sheet and nowhere else.</div>
        </details>

        <div className={`rounded-xl border p-3 ${p.connected ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium flex items-center gap-2">
                <span>{p.connected ? `Connected as ${showEmail ? p.email : maskEmail(p.email)}` : p.email ? `Not connected (last ${showEmail ? p.email : maskEmail(p.email)})` : 'Not connected to Google Sheets'}</span>
                {p.email && <button type="button" className="ib" title={showEmail ? 'Hide email' : 'Show email'} onClick={() => setShowEmail((s) => !s)}>{showEmail ? '🙈' : '👁'}</button>}
                {p.email && <button type="button" className="ib" title="Copy email" onClick={() => { void copyText(p.email); }}>📋</button>}
              </div>
              {url && (
                <div className="flex items-center gap-2 mt-1">
                  <a className="text-xs underline text-emerald-700 dark:text-emerald-400 break-all" href={url} target="_blank" rel="noreferrer">{showUrl ? url : maskSpreadsheetUrl(url)}</a>
                  <button type="button" className="ib" title={showUrl ? 'Hide spreadsheet url' : 'Show spreadsheet url'} onClick={() => setShowUrl((s) => !s)}>{showUrl ? '🙈' : '👁'}</button>
                  <button type="button" className="ib" title="Copy spreadsheet url" onClick={() => { void copyText(url); }}>📋</button>
                </div>
              )}
              {p.sheetTitle && <div className="text-[10px] text-slate-400 mt-1">"{p.sheetTitle}"</div>}
            </div>
            {p.connected
              ? <button className="btn sm danger" onClick={p.onDisconnect} disabled={p.busy}>Disconnect</button>
              : <button className="btn sm primary" onClick={p.onConnect} disabled={p.busy || !p.cfg.clientId}>Connect Google</button>}
          </div>
        </div>

        <MaskedField label="Google OAuth Client ID" value={p.cfg.clientId} mask={maskId} placeholder="1234567890-abc.apps.googleusercontent.com" onChange={(v) => p.setCfg((c) => ({ ...c, clientId: v.trim() }))} hint="Public, no secret. Stored in this browser only." />
        <MaskedField label="Spreadsheet ID or full URL" value={p.cfg.spreadsheetId} mask={(v) => (v.includes('/d/') ? maskSpreadsheetUrl(v) : maskId(v))} placeholder="https://docs.google.com/spreadsheets/d/1abc…/edit" onChange={(v) => p.setCfg((c) => ({ ...c, spreadsheetId: v.trim() }))} hint="One spreadsheet holds the tabs of ALL your accounts." />

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn sm primary" onClick={p.onList} disabled={p.busy || !p.connected || !id} title="List the X-<handle> tabs of the spreadsheet in the log">Attach / list tabs</button>
          <button className="btn sm" onClick={p.onCreate} disabled={p.busy || !p.cfg.clientId} title="A new spreadsheet in your Google Drive">Create new spreadsheet</button>
          <a className="btn sm" href={USERSCRIPT_URL}>Install userscript</a>
          <button className="btn sm" onClick={p.onImport} title="A JSON file downloaded from the badge on x.com">Import JSON</button>
          <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 ml-auto"><input type="checkbox" checked={p.cfg.withReplies} onChange={(e) => p.setCfg((c) => ({ ...c, withReplies: e.target.checked }))} /> sync replies too</label>
        </div>
        <div className="text-[10px] text-slate-400">Current account tab (auto): <span className="font-mono">{p.handle ? tabOf(p.handle) : '—'}</span></div>
      </div>
    </div>
  );
}

// ---- 4. Post card ------------------------------------------------------------------------------------

const MEDIA_ICON: Record<string, string> = { photo: '📷', video: '🎬', gif: 'GIF' };
const TYPE_HELP: Record<string, string> = {
  post: 'post: the account wrote it',
  reply: 'reply: an answer under someone else\'s post',
  repost: 'repost: someone else\'s post shared as is (a retweet)',
  quote: 'quote: someone else\'s post with the account\'s own words on top',
};
type LightboxItem = { kind: string; url: string };

/** Full size of a photo (X serves the large variant with name=large). */
const fullSize = (url: string): string => (/^https:\/\/pbs\.twimg\.com\/media\//.test(url) && !/[?&]name=/.test(url) ? `${url}${url.includes('?') ? '&' : '?'}name=large` : url);

/** Modal with a zoom-in animation: a photo full size, an X video with controls, a gif looping, a YouTube link as the embedded player. */
function Lightbox({ items, index, onIndex, onClose }: { items: LightboxItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => { setClosing(true); window.setTimeout(onClose, 180); }, [onClose]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' && index < items.length - 1) onIndex(index + 1);
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    document.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [close, index, items.length, onIndex]);
  const it = items[index];
  if (!it) return null;
  const yt = it.kind === 'youtube' ? youtubeId(it.url) : null;
  return (
    <div className={`lb ${closing ? 'out' : ''}`} onClick={close} data-lightbox={it.kind}>
      <div className="lb-box" onClick={(e) => e.stopPropagation()}>
        {it.kind === 'photo' && <img src={fullSize(it.url)} alt="" />}
        {it.kind === 'video' && <video src={it.url} controls autoPlay playsInline />}
        {it.kind === 'gif' && <video src={it.url} autoPlay loop muted playsInline />}
        {yt && <iframe src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`} title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />}
        {it.kind === 'youtube' && !yt && <a className="text-emerald-400 underline" href={it.url} target="_blank" rel="noreferrer">{it.url}</a>}
        <div className="lb-bar">
          <button type="button" className="lb-btn" onClick={() => onIndex(index - 1)} disabled={index <= 0} title="Previous (←)">‹</button>
          <span>{index + 1} / {items.length} · {it.kind}</span>
          <button type="button" className="lb-btn" onClick={() => onIndex(index + 1)} disabled={index >= items.length - 1} title="Next (→)">›</button>
          <a className="lb-btn" href={it.url} target="_blank" rel="noreferrer" title="Open the file in a new tab">↗</a>
        </div>
        <button type="button" className="lb-btn lb-x" onClick={close} title="Close (Esc)">✕</button>
      </div>
    </div>
  );
}
const PREVIEW_DELAY_MS = 1000;

/** Inline photos, videos and gifs of a post (the media column when 🖼 media is on, and the hover preview). */
function MediaInline({ media, scale, className }: { media: Media[]; scale: number; className: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {media.map((m, i) => (m.type === 'photo'
        ? <a key={i} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" loading="lazy" className="rounded-lg border border-slate-200 dark:border-slate-700 object-cover" style={{ maxHeight: `${Math.round(220 * scale)}px` }} /></a>
        : <video key={i} src={m.url} controls={m.type === 'video'} autoPlay={m.type === 'gif'} loop={m.type === 'gif'} muted={m.type === 'gif'} playsInline preload={m.type === 'gif' ? 'auto' : 'metadata'} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-black" style={{ maxHeight: `${Math.round(260 * scale)}px`, maxWidth: '100%' }} />))}
    </div>
  );
}

/**
 * Hover preview while 🖼 media is off: the mouse rests a second on the media badge (or the "media only" note) and a
 * floating box shows the photos, videos and gifs of that post; it goes when the mouse leaves.
 */
function useHoverPreview() {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef(0);
  const enter = (e: { clientX: number; clientY: number }) => {
    const x = e.clientX; const y = e.clientY;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAt({ x, y }), PREVIEW_DELAY_MS);
  };
  const leave = () => { window.clearTimeout(timer.current); setAt(null); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { at, enter, leave };
}

/** One post as a table row, the youtube inventory look: date, type, text, stats, Open, the crossed eye. */
function PostRow({ post: p, scale, onOpenMedia, onToggleHidden, sentinel }: { post: Post; scale: number; onOpenMedia: (items: LightboxItem[], index: number) => void; onToggleHidden: () => void; sentinel?: RefObject<HTMLTableRowElement | null> }) {
  const parts = useMemo(() => linkify(p.text), [p.text]);
  const preview = useHoverPreview();
  const py = `${Math.round(10 * scale)}px`;
  const small = `${Math.round(11 * scale)}px`;
  const t = Date.parse(p.created_at);
  const d = Number.isFinite(t) ? new Date(t) : null;
  const date = d ? d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }) : p.created_at || '—';
  const time = d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
  const media = new Map<string, number>();
  p.media.forEach((m) => media.set(m.type, (media.get(m.type) || 0) + 1));
  const yt = youtubeLinks(p);
  const items: LightboxItem[] = [...p.media.map((m) => ({ kind: m.type, url: m.url })), ...yt.map((url) => ({ kind: 'youtube' as const, url }))];
  const firstOf = (kind: string) => Math.max(0, items.findIndex((it) => it.kind === kind));
  // nothing to read (media only): the row is dimmed like a hidden one, the media badge says what is there, a second on it previews
  const mediaOnly = !p.text && p.media.length > 0;
  const dim = p.hidden || mediaOnly;
  const rowClass = p.hidden ? 'opacity-40' : dim ? 'opacity-60' : '';
  const context = p.type === 'repost' && p.reposted_handle ? `↻ repost of @${p.reposted_handle}` : p.type === 'reply' && p.in_reply_to_handle ? `↩ to @${p.in_reply_to_handle}` : p.type === 'quote' && p.quoted_id ? '❝ quotes a post' : '';
  return (
    <tr ref={sentinel} className={`post transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/20 group ${rowClass}`} data-hidden={p.hidden ? '1' : '0'} data-dim={dim ? '1' : '0'} data-sentinel={sentinel ? '1' : undefined}>
      <td className="px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap align-top" style={{ paddingTop: py, paddingBottom: py }} title={p.created_at}>
        <span className="hidden 2xl:inline">{date}, {time}</span>
        <span className="block 2xl:hidden leading-tight"><span className="block">{date}</span><span className="block">{time}</span></span>
      </td>
      <td className="px-4 whitespace-nowrap align-top" style={{ paddingTop: py, paddingBottom: py }}>
        <span className={`badge ${p.type}`} title={TYPE_HELP[p.type]}>{p.type}</span>
        {p.is_pinned && <span className="badge pinned ml-1" title="Pinned to the top of the profile">pinned</span>}
      </td>
      <td className="px-4 whitespace-nowrap align-top" style={{ paddingTop: py, paddingBottom: py }}>
        {items.length > 0 ? (
          <span className="media-badge text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2" style={{ fontSize: small }} onMouseEnter={preview.enter} onMouseLeave={preview.leave} title="Click to open full size; rest the mouse a second for a preview">
            {Array.from(media.entries()).map(([k, n]) => <button key={k} type="button" onClick={() => onOpenMedia(items, firstOf(k))} data-open-media={k}>{MEDIA_ICON[k] || k}{n > 1 ? ` ×${n}` : ''}</button>)}
            {yt.length > 0 && <button type="button" onClick={() => onOpenMedia(items, firstOf('youtube'))} data-open-media="youtube">▶ YouTube{yt.length > 1 ? ` ×${yt.length}` : ''}</button>}
          </span>
        ) : <span className="text-slate-300 dark:text-slate-600" style={{ fontSize: small }}>—</span>}
        {preview.at && p.media.length > 0 && (
          <div className="media-preview fixed z-[2147483000] card p-2 shadow-2xl" style={{ left: Math.min(preview.at.x + 16, window.innerWidth - 380), top: Math.min(preview.at.y + 16, window.innerHeight - 300), width: 360, maxWidth: 'calc(100vw - 32px)' }} onMouseLeave={preview.leave}>
            <MediaInline media={p.media} scale={Math.min(scale, 1)} className="" />
          </div>
        )}
      </td>
      <td className="px-4 align-top" style={{ paddingTop: py, paddingBottom: py }}>
        {(context || p.type === 'repost') && <div className="text-slate-500 dark:text-slate-400" style={{ fontSize: small }}>{context}{p.type === 'repost' && p.author_name ? ` · ${p.author_name}` : ''}</div>}
        <div className="post-text leading-snug">
          {parts.map((x, i) => (x.kind === 'link' ? <a key={i} href={x.value} target="_blank" rel="noreferrer">{x.value}</a> : <span key={i}>{x.value}</span>))}
          {!p.text && <span className="text-slate-400 cursor-help" onMouseEnter={mediaOnly ? preview.enter : undefined} onMouseLeave={preview.leave}>{mediaOnly ? '(media only, see the Media column)' : '(no text)'}</span>}
        </div>
      </td>
      <td className="px-4 whitespace-nowrap align-top text-slate-500 dark:text-slate-400 hidden lg:table-cell" style={{ paddingTop: py, paddingBottom: py, fontSize: small }}>
        <span title="replies">💬 {formatCount(p.replies)}</span> <span title="reposts">🔁 {formatCount(p.reposts)}</span> <span title="likes">❤ {formatCount(p.likes)}</span>
        {p.views > 0 && <> <span title="views">👁 {formatCount(p.views)}</span></>}
        {p.bookmarks > 0 && <> <span title="bookmarks">🔖 {formatCount(p.bookmarks)}</span></>}
      </td>
      <td className="px-4 whitespace-nowrap align-top" style={{ paddingTop: py, paddingBottom: py }}>
        <a className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline" href={p.url} target="_blank" rel="noreferrer">Open ↗</a>
      </td>
      <td className="px-4 whitespace-nowrap align-top text-right" style={{ paddingTop: py, paddingBottom: py }}>
        <button type="button" className="ib" title={p.hidden ? 'Show this post again' : 'Hide this post (noise, not important)'} onClick={onToggleHidden}>{p.hidden ? '👁' : '🙈'}</button>
      </td>
    </tr>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(<StrictMode><App /></StrictMode>);
