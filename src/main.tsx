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
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { byNewest, mergePosts, type Post, type PostType, POST_TYPES } from '../shared/post';
import { ackBatches, connectBridge, sendMeta, type Batch, type Run, type Status } from './bridge';
import { applyFilters, EMPTY_FILTERS, formatCount, linkify, postsFromJson, toCsv, type Filters, type SortKey } from './filters';
import { fetchEmail, GoogleSession } from './gis';
import type { GoogleCreds } from '../shared/post';
import { maskEmail, maskId, maskSpreadsheetUrl } from './mask';
import { createSpreadsheet, deleteTab, ensureTab, handleOfTab, listTabs, readPosts, spreadsheetId, spreadsheetUrl, tabOf, writePosts } from './sheets';

// ---- 1. Storage (config, accounts, a copy of the posts; the view) -------------------------------------

const PREFIX = 'twitter';
const THEME_KEY = `${PREFIX}-theme`;
const CONFIG_KEY = `${PREFIX}-gs-config`;
const FILTERS_KEY = `${PREFIX}-filters`;
const CURRENT_KEY = `${PREFIX}-current`;
const postsKey = (handle: string) => `${PREFIX}-posts-${handle}`;
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

const cleanHandle = (s: string): string => s.trim().replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//i, '').split(/[/?#]/)[0].toLowerCase();
const isHandle = (s: string): boolean => /^[a-z0-9_]{1,15}$/.test(s);
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
  const [dark, setDark] = useState(() => lsGet(THEME_KEY) === 'dark');
  const [cfg, setCfg] = useState<Config>(loadConfig);
  const [showSettings, setShowSettings] = useState(() => !loadConfig().clientId);
  const [showLog, setShowLog] = useState(false);
  const [current, setCurrent] = useState(() => lsGet(CURRENT_KEY) || '');
  const [handle, setHandle] = useState(() => cleanHandle(lsGet(CURRENT_KEY) || ''));
  const [posts, setPosts] = useState<Post[]>(() => loadCachedPosts(cleanHandle(lsGet(CURRENT_KEY) || '')));
  const [fromSheet, setFromSheet] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, ...lsJson<Partial<Filters>>(FILTERS_KEY, {}), handles: [] }));
  const [shown, setShown] = useState(PAGE_SIZE);
  const [email, setEmail] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [log, setLog] = useState<LogLine[]>([]);
  const [scriptVersion, setScriptVersion] = useState('');
  const [stamp, setStamp] = useState(''); // the DOM mark the userscript leaves even when its messages do not arrive
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

  const say = useCallback((msg: string) => {
    setLog((l) => [{ ts: new Date().toLocaleTimeString(), msg }, ...l].slice(0, 200));
  }, []);

  useEffect(() => { lsSet(THEME_KEY, dark ? 'dark' : 'light'); document.documentElement.classList.toggle('dark', dark); document.documentElement.style.backgroundColor = dark ? '#020617' : '#f8fafc'; }, [dark]);
  useEffect(() => { lsSet(CONFIG_KEY, JSON.stringify(cfg)); }, [cfg]);
  useEffect(() => { lsSet(CURRENT_KEY, current); }, [current]);
  useEffect(() => { lsSet(FILTERS_KEY, JSON.stringify(filters)); setShown(PAGE_SIZE); }, [filters]);

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
    if (h === handleRef.current) { setPosts(list); setFromSheet(sheet); }
  }, []);

  /** The handle in the toolbar field; an invalid one shows an error and gives null. */
  const readField = useCallback((): string | null => {
    const h = cleanHandle(current);
    if (!isHandle(h)) { setError('Type an X profile link or @handle (1 to 15 letters, digits or _)'); return null; }
    if (h !== handleRef.current) {
      handleRef.current = h;
      setHandle(h);
      setPosts(loadCachedPosts(h));
      setFromSheet(false);
    }
    return h;
  }, [current]);

  const loadFromSheet = useCallback(async (h: string, quiet = false): Promise<Post[] | null> => {
    const list = await withSheet(`Loading @${h}`, async (token, id) => {
      await ensureTab(token, id, tabOf(h));
      return readPosts(token, id, tabOf(h));
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
      const tab = tabOf(h);
      await ensureTab(token, id, tab);
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

  // ---- feed ----
  const feed = useMemo(() => applyFilters(posts, filters), [posts, filters]);
  const visible = feed.slice(0, shown);
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const lastRun = runs.filter((r) => r.handle === handle).sort((a, b) => (a.finished_at < b.finished_at ? 1 : -1))[0];
  const exportCsv = () => download(`x-${handle || 'feed'}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(feed), 'text/csv');
  const exportJson = () => download(`x-${handle || 'feed'}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ posts: feed }, null, 2), 'application/json');
  const filtersOn = JSON.stringify({ ...filters, handles: [] }) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="flex min-h-screen flex-col">
      {/* toolbar, the youtube one: field, settings, status dots, update, full refresh, cloud, attach, export, theme */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="px-4 sm:px-8">
          <div className="flex flex-col md:flex-row md:items-center gap-2 py-3">
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
              {cfg.clientId && (connected
                ? <button className="tb rose" title="Disconnect Google" onClick={disconnect} disabled={isBusy}>🔌</button>
                : <button className="tb blue" title="Connect Google Sheets" onClick={() => { void connect(true); }} disabled={isBusy}>☁️</button>)}
              {connected && sid && <button className="tb green" title="Ensure the tab and reload the posts from Google Sheets" onClick={() => { void load(); }} disabled={isBusy || !current.trim()}>↻</button>}
              <button className="tb green" title="Export CSV" onClick={exportCsv} disabled={!feed.length}>📥</button>
              <button className="tb" title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark((d) => !d)}>{dark ? '☀' : '🌙'}</button>
            </div>
          </div>

          {/* log console, slides open */}
          <div id="log-wrap" className={`slide-wrap ${showLog ? 'open' : ''}`}>
            <div className="slide-inner">
              <div className="pb-2">
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

      <div className="flex-1 px-4 sm:px-8 pt-1 space-y-3">
        {error && (
          <div className="card status-bad px-3 py-2 text-sm flex justify-between gap-2 animate-fade-in">
            <span className="break-words">{error}</span>
            <button className="font-bold" onClick={() => setError('')} aria-label="Dismiss">×</button>
          </div>
        )}
        {busy && <div className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">{busy}</div>}
        {!scriptVersion && !stamp && (
          <div className="card status-warn px-3 py-2 text-sm animate-fade-in" data-hint="no-script">
            <b>The userscript is not running on this page</b> (first dot red), so posts collected on x.com cannot reach the sheet. Check: click the Tampermonkey icon in the Chrome toolbar while on this page; it must list "X -&gt; Google Sheets sync" as running here. If it does not: chrome://extensions, Tampermonkey, Details, Site access, add <code className="px-1">https://daggerok.github.io/*</code> next to x.com; then install <a className="underline" href={USERSCRIPT_URL}>x-sync.user.js</a> if not yet, and reload this page. The dot turns green when it works.
          </div>
        )}
        {!scriptVersion && stamp && (
          <div className="card status-bad px-3 py-2 text-sm animate-fade-in" data-hint="bridge">
            <b>The userscript v{stamp} runs on this page but its messages do not arrive</b> (first dot red). Reload the page once; if it stays red, open the browser console (F12, Console) on this page and send its lines to the repo issues.
          </div>
        )}

        {/* settings, slides open */}
        <div id="settings-wrap" className={`slide-wrap ${showSettings ? 'open' : ''}`}>
          <div className="slide-inner">
            <Settings
              cfg={cfg} setCfg={setCfg} connected={connected} email={email || cfg.lastAccountEmail} busy={isBusy} sheetTitle={sheetTitle} handle={handle}
              onClose={() => setShowSettings(false)} onConnect={() => { void connect(true); }} onDisconnect={disconnect}
              onCreate={() => { void createSheet(); }} onList={() => { void listSheet(); }} onImport={() => fileInput.current?.click()}
            />
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ''; }} />
          </div>
        </div>

        {/* inbox from the userscript */}
        {(outboxCount > 0 || runStatus?.state === 'running') && (
          <section className="card px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2 animate-fade-in">
            <div>
              {runStatus?.state === 'running' && <div>⏳ Syncing @{runStatus.handle} ({runStatus.mode}): {runStatus.seen} posts so far{runStatus.message ? ` · ${runStatus.message}` : ''}</div>}
              {outboxCount > 0 && <div>📥 {outboxCount} captured posts waiting{canStore ? ', storing…' : ' (connect Google and set the spreadsheet to store them)'}</div>}
            </div>
            {outboxCount > 0 && !canStore && <button className="btn sm primary" onClick={() => { void connect(true); }}>Connect Google</button>}
          </section>
        )}

        {/* feed of the current account */}
        <section className="card p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {handle ? <a className="text-emerald-600 dark:text-emerald-400" href={`https://x.com/${handle}`} target="_blank" rel="noreferrer">@{handle}</a> : 'Feed'}
              <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{feed.length} of {posts.length}{handle && !fromSheet && posts.length ? ' (local copy)' : ''}{lastRun ? ` · last sync ${fmtDate(lastRun.finished_at)}: ${lastRun.posts_seen} seen, ${lastRun.stop_reason.replace(/_/g, ' ')}` : ''}</span>
            </h2>
            <div className="flex gap-1">
              <button className="btn sm" onClick={exportCsv} disabled={!feed.length}>CSV</button>
              <button className="btn sm" onClick={exportJson} disabled={!feed.length}>JSON</button>
              <button className="btn sm" onClick={() => setFilters({ ...EMPTY_FILTERS })} disabled={!filtersOn}>Clear filters</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input className="inp max-w-xs" placeholder="Search text, author, link" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
            {POST_TYPES.map((t: PostType) => (
              <button key={t} className={`btn sm ${filters.types.includes(t) ? 'active' : ''}`} onClick={() => setFilters((f) => ({ ...f, types: toggleIn(f.types, t) as PostType[] }))}>{t}</button>
            ))}
            <button className={`btn sm ${filters.hasMedia ? 'active' : ''}`} onClick={() => setFilters((f) => ({ ...f, hasMedia: !f.hasMedia }))}>has media</button>
            <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">from <input className="inp" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} /></label>
            <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">to <input className="inp" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} /></label>
            <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">sort
              <select className="inp" value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as SortKey }))}>
                <option value="date">date</option><option value="likes">likes</option><option value="views">views</option><option value="reposts">reposts</option><option value="replies">replies</option>
              </select>
            </label>
          </div>
          {visible.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {!handle ? 'Type an X profile link or @handle in the field above, then ⬇ to sync its posts (or Enter to show what the sheet already has).' : posts.length ? 'Nothing to show with these filters.' : `No posts of @${handle} yet: press ⬇ to sync them from x.com.`}
            </p>
          )}
          <ul className="space-y-2">
            {visible.map((p) => <PostCard key={p.id} post={p} />)}
          </ul>
          {feed.length > shown && <button className="btn w-full justify-center" onClick={() => setShown((s) => s + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, feed.length - shown)} more of {feed.length - shown}</button>}
        </section>
      </div>

      <footer className="text-center text-[10px] text-slate-400 dark:text-slate-600 px-4 sm:px-8 pb-[3.5px] sm:pb-[19.5px] pt-3">
        <a className="underline decoration-dotted" href={REPO_URL} target="_blank" rel="noreferrer">daggerok</a> (c) {new Date().getFullYear()}
      </footer>
    </div>
  );
}

// ---- 3. Settings (masked values with eye and copy, like youtube) -----------------------------------------

type SettingsProps = {
  cfg: Config; setCfg: (f: (c: Config) => Config) => void; connected: boolean; email: string; busy: boolean; sheetTitle: string; handle: string;
  onClose: () => void; onConnect: () => void; onDisconnect: () => void; onCreate: () => void; onList: () => void; onImport: () => void;
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
    <div className="card overflow-hidden text-sm mb-2 shadow-lg">
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

function PostCard({ post: p }: { post: Post }) {
  const parts = useMemo(() => linkify(p.text), [p.text]);
  const who: ReactNode = p.type === 'repost' && p.reposted_handle
    ? <>@{p.handle} reposted <a className="underline" href={`https://x.com/${p.reposted_handle}`} target="_blank" rel="noreferrer">@{p.reposted_handle}</a></>
    : <><span className="font-medium">{p.author_name || `@${p.handle}`}</span> <span className="text-slate-500 dark:text-slate-400">@{p.handle}</span></>;
  return (
    <li className="card p-3 space-y-2 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`badge ${p.type}`}>{p.type}</span>
        {p.is_pinned && <span className="badge pinned">pinned</span>}
        <span className="text-sm">{who}</span>
        {p.type === 'reply' && p.in_reply_to_handle && <span className="text-slate-500 dark:text-slate-400">replying to @{p.in_reply_to_handle}</span>}
        <a className="ml-auto text-slate-500 dark:text-slate-400 underline" href={p.url} target="_blank" rel="noreferrer" title={p.created_at}>{fmtDate(p.created_at)}</a>
      </div>
      {p.text && (
        <p className="post-text text-sm">
          {parts.map((x, i) => (x.kind === 'link' ? <a key={i} href={x.value} target="_blank" rel="noreferrer">{x.value}</a> : <span key={i}>{x.value}</span>))}
        </p>
      )}
      {p.media.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {p.media.map((m, i) => (m.type === 'photo'
            ? <a key={i} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" loading="lazy" className="h-24 w-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700" /></a>
            : <a key={i} href={m.url} target="_blank" rel="noreferrer" className="btn sm">▶ {m.type}</a>))}
        </div>
      )}
      {p.quoted_id && <a className="text-xs underline text-slate-500 dark:text-slate-400" href={`https://x.com/i/status/${p.quoted_id}`} target="_blank" rel="noreferrer">quoted post</a>}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span title="replies">💬 {formatCount(p.replies)}</span>
        <span title="reposts">🔁 {formatCount(p.reposts)}</span>
        <span title="likes">❤ {formatCount(p.likes)}</span>
        {p.quotes > 0 && <span title="quotes">❝ {formatCount(p.quotes)}</span>}
        {p.bookmarks > 0 && <span title="bookmarks">🔖 {formatCount(p.bookmarks)}</span>}
        {p.views > 0 && <span title="views">👁 {formatCount(p.views)}</span>}
        <a className="ml-auto underline" href={p.url} target="_blank" rel="noreferrer">Open on X</a>
      </div>
    </li>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) createRoot(rootEl).render(<StrictMode><App /></StrictMode>);
