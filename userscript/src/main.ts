/// <reference lib="esnext" />
// =========================================================================
// Entry of the userscript. Two homes:
// - x.com / twitter.com: install the fetch and XHR interceptor right away (document-start), then on a
//   profile page mount the badge; a run is started by its buttons, the Tampermonkey menu or the url
//   hash `#xsync=full` / `#xsync=incremental` that the viewer opens the profile with
// - the viewer (GitHub Pages or localhost): the postMessage bridge to Tampermonkey storage (bridge.ts)
// =========================================================================
import { handleFromPath, sameHandle, type Post } from '../../shared/post';
import { Badge, downloadJson } from './badge';
import { installViewerBridge } from './bridge';
import { gmDel, gmGet, gmMenu, gmSet, hasGM, KEYS, newId, scriptVersion, type Run, type RunMode, type StopReason } from './gm';
import { diag, installInterceptor } from './intercept';
import { parseTimeline, parseUser, type AccountInfo } from './parse';
import { runSync, TimelineFeed } from './scroll';
import { loadSettings } from './settings';
import { openSettings } from './settings-ui';
import { DirectWriter, loadCreds } from './sheets-gm';
import { knownNewestId, recordRun, rememberNewestId, setStatus, Sink } from './sink';

const VERSION = scriptVersion();
const IS_X = /(^|\.)(x|twitter)\.com$/.test(location.hostname);

function readHashMode(): RunMode | null {
  const m = /[#&]xsync=(full|incremental)/.exec(location.hash);
  if (!m) return null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  return m[1] === 'full' ? 'full' : 'incremental';
}

function onX(): void {
  const feed = new TimelineFeed();
  let currentHandle = '';
  let account: AccountInfo | null = null;
  const intercepted = installInterceptor((op, json) => {
    if (op === 'UserByScreenName') { account = parseUser(json) || account; return; }
    const handle = handleFromPath(location.pathname) || '';
    const r = parseTimeline(json, handle);
    diag.parsed[op] = (diag.parsed[op] || 0) + r.posts.length;
    if (r.errors) diag.errors.push(`${op}: ${r.errors} entries threw`);
    if (r.account && (!account || account.handle === r.account.handle)) account = r.account;
    if (r.posts.length) feed.onTimeline(r.posts);
  }, (_op, status) => feed.onStatus(status));

  let running = false;
  let stopRequested = false;
  let lastRunPosts: Post[] = [];
  let elapsedTimer = 0;
  // Watch: the profile is reloaded every watchEveryMin minutes and the new posts synced, until Stop (kept in GM storage
  // so it survives the reload; X does not push new posts into an open profile page)
  type Watch = { handle: string; since: string };
  const watching = (): Watch | null => { const w = gmGet<Watch | null>(KEYS.watch, null); return w && sameHandle(w.handle, handleFromPath(location.pathname) || '') ? w : null; };
  let watchTimer = 0;
  let watchCountdown = 0;
  const scheduleWatch = () => {
    const w = watching();
    if (!w) return;
    const every = loadSettings().watchEveryMin;
    const due = Date.now() + every * 60_000;
    const tick = () => {
      const left = Math.max(0, due - Date.now());
      if (left <= 0) { location.reload(); return; }
      badge.setWatch(`watching since ${w.since.slice(11, 16)} · next check in ${Math.ceil(left / 60_000)} min`);
    };
    window.clearInterval(watchCountdown);
    watchCountdown = window.setInterval(tick, 10_000);
    tick();
  };
  const badge = new Badge({
    start: (mode) => { void start(mode); },
    stop: () => { stopRequested = true; gmDel(KEYS.watch); window.clearInterval(watchCountdown); window.clearTimeout(watchTimer); badge.setWatch(''); badge.set(running ? 'stopping after this scroll…' : 'watch off'); },
    watch: () => {
      const h = handleFromPath(location.pathname);
      if (!h || running) return;
      gmSet(KEYS.watch, { handle: h, since: new Date().toISOString() });
      void start('incremental');
    },
    settings: () => openSettings(() => badge.set('settings saved')),
    debug: () => downloadJson(`x-sync-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`, {
      version: VERSION, url: location.href, handle: currentHandle, account, intercepted, running,
      settings: loadSettings(), apiPayloads: feed.apiPayloads, gm: hasGM(), ...diag,
    }),
    downloadJson: () => downloadJson(`x-${currentHandle || 'posts'}-${new Date().toISOString().slice(0, 10)}.json`, { version: VERSION, handle: currentHandle, account, posts: lastRunPosts }),
  }, VERSION);

  const mountIfProfile = () => {
    const h = handleFromPath(location.pathname);
    if (h) {
      if (!sameHandle(h, currentHandle)) { currentHandle = h; if (!running) account = null; }
      badge.mount();
      if (!running) badge.set(`profile @${h}${hasGM() ? '' : '\nTampermonkey storage unavailable'}${intercepted ? '' : '\nno api access: DOM fallback only'}`);
    } else if (!running) {
      badge.unmount();
      currentHandle = '';
    }
  };

  async function start(mode: RunMode): Promise<void> {
    const path = handleFromPath(location.pathname);
    if (!path || running) return;
    // the tab is named with the case X shows (screen_name of the UserByScreenName answer), else the url's
    const handle = account && sameHandle(account.handle, path) ? account.display_handle : path;
    running = true;
    stopRequested = false;
    currentHandle = handle;
    const settings = loadSettings();
    const runId = newId('run');
    const sink = new Sink(handle, runId);
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    const newestId = mode === 'incremental' ? knownNewestId(handle) : '';
    // direct writes when the viewer shared a fresh Google token (Tampermonkey storage), else the outbox
    let stored = 0;
    let writeError = '';
    const creds = loadCreds();
    if (creds) {
      const w = new DirectWriter(creds, handle);
      try {
        await w.prepare();
        sink.writer = w;
        sink.onWritten = (ins, upd, err) => { stored += ins + upd; if (err) writeError = err; };
      } catch (e) {
        writeError = e instanceof Error ? e.message : String(e);
      }
    }
    const effectiveMode: RunMode = mode === 'incremental' && !newestId ? 'full' : mode;
    badge.setRunning(true);
    badge.setJsonAvailable(false);
    // the source is known while the run goes: a timeline response seen through the interceptor means graphql, else the DOM reader
    const liveSource = () => (feed.apiPayloads > 0 ? 'graphql' : sink.posts.size > 0 ? 'dom' : '…');
    const status = (state: 'running' | 'paused' | 'done', message: string, stop: StopReason | '' = '') =>
      setStatus({ state, handle, mode: effectiveMode, seen: sink.posts.size, fresh: sink.posts.size, started_at: startedAt, message: `${message ? `${message} · ` : ''}source: ${liveSource()}`, stop_reason: stop });
    let note = effectiveMode === 'full' && mode === 'incremental' ? 'nothing stored yet: full run' : '';
    const where = () => (sink.writer ? `${stored} in the sheet${writeError ? ' · write error, rest waits for the viewer' : ''}` : creds ? `sheet unreachable: ${writeError.slice(0, 60)}` : 'no Google token yet: open the viewer once, then the sheet is written from here');
    const paint = () => {
      const secs = Math.round((Date.now() - t0) / 1000);
      const hidden = document.visibilityState === 'hidden';
      badge.set(`@${handle} · ${effectiveMode} · ${liveSource()}${hidden ? ' · paused (tab hidden)' : ''}\n${sink.posts.size} posts · ${Math.floor(secs / 60)}m ${secs % 60}s · ${where()}${note ? `\n${note}` : ''}`);
    };
    elapsedTimer = window.setInterval(paint, 1000);
    status('running', note);
    let result: Awaited<ReturnType<typeof runSync>>;
    try {
      result = await runSync({
        handle, mode: effectiveMode, newestId, settings, sink,
        onProgress: (_seen, _fresh, n) => { if (n) note = n; paint(); status('running', note); },
        isStopped: () => stopRequested,
      }, feed);
    } catch (e) {
      result = { stop: 'stopped', source: 'none', sawFromApi: 0, sawFromDom: 0 };
      note = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
    window.clearInterval(elapsedTimer);
    sink.flush();
    await sink.done();
    rememberNewestId(handle, sink.newestId);
    lastRunPosts = Array.from(sink.posts.values());
    const run: Run = {
      run_id: runId, handle, started_at: startedAt, finished_at: new Date().toISOString(), mode: effectiveMode,
      posts_seen: sink.posts.size, posts_new: sink.posts.size, stop_reason: result.stop, userscript_version: VERSION, source: result.source,
      stored_in_sheet: sink.writer ? stored : 0,
    };
    recordRun(run);
    status('done', note, result.stop);
    running = false;
    badge.setRunning(false);
    badge.setJsonAvailable(lastRunPosts.length > 0);
    badge.set(`@${handle} · done: ${result.stop.replace(/_/g, ' ')}\n${sink.posts.size} posts (${result.source}) · ${where()}${note ? `\n${note}` : ''}\n${sink.writer && !writeError ? 'open the viewer to see them' : 'open the viewer to store them'}`);
    scheduleWatch();
  }

  const boot = () => {
    mountIfProfile();
    gmMenu('X sync: sync new posts of this profile', () => { void start('incremental'); });
    gmMenu('X sync: full sync of this profile', () => { void start('full'); });
    gmMenu('X sync: settings', () => openSettings(() => badge.set('settings saved')));
    const hashMode = readHashMode();
    if (hashMode) setTimeout(() => { void start(hashMode); }, 2500); // let the first timeline request answer
    else if (watching()) watchTimer = window.setTimeout(() => { void start('incremental'); }, 2500); // a watched profile just reloaded itself
    // X is a single page app: watch the url
    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) { lastPath = location.pathname; mountIfProfile(); }
    }, 800);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}

if (IS_X) onX();
else installViewerBridge(VERSION);
