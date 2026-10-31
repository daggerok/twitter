/// <reference lib="esnext" />
// =========================================================================
// The run: scroll the profile timeline gently until a stop condition, feeding every captured post to
// the sink. The interceptor (installed at document-start by main.ts) calls `onTimeline` for each
// GraphQL response; when none arrived for 10 s the DOM fallback reads the rendered cards instead.
// Stop reasons: stopped (the Stop button), caught_up (incremental: an id <= the newest stored one),
// end_of_timeline (idleScrolls scrolls without a new post), max_posts and max_minutes (only when set, off by
// default: the owner wants a run to go on until the timeline ends or Stop is pressed), rate_limited
// (HTTP 429 or the "Something went wrong" card after one Retry), left_profile (the url changed).
// =========================================================================
import { compareIds, handleFromPath, type Post } from '../../shared/post';
import { scanDom } from './dom-fallback';
import type { RunMode, StopReason } from './gm';
import type { Settings } from './settings';
import type { Sink } from './sink';

export type RunOptions = {
  handle: string;
  mode: RunMode;
  newestId: string;        // incremental: stop at this id; '' means full
  settings: Settings;
  sink: Sink;
  onProgress: (seen: number, fresh: number, note: string) => void;
  isStopped: () => boolean;
};

export type RunResult = { stop: StopReason; source: 'graphql' | 'dom' | 'mixed' | 'none'; sawFromApi: number; sawFromDom: number };

const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Pause while the tab is hidden; resolves at once when it is visible. */
async function whileVisible(): Promise<void> {
  while (document.visibilityState === 'hidden') await sleep(500);
}

function retryButton(): HTMLElement | null {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('[role="button"]'));
  return buttons.find((b) => /^(retry|try again)$/i.test((b.textContent || '').trim())) || null;
}

function errorCardShown(): boolean {
  return /something went wrong/i.test(document.body.innerText.slice(0, 20_000)) && !!retryButton();
}

export class TimelineFeed {
  private queue: Post[] = [];
  private rateLimited = false;
  lastApiAt = 0;
  apiPayloads = 0;

  onTimeline(posts: Post[]): void {
    this.queue.push(...posts);
    this.lastApiAt = Date.now();
    this.apiPayloads += 1;
  }

  onStatus(status: number): void {
    if (status === 429) this.rateLimited = true;
  }

  take(): Post[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  takeRateLimited(): boolean {
    const r = this.rateLimited;
    this.rateLimited = false;
    return r;
  }
}

export async function runSync(o: RunOptions, feed: TimelineFeed): Promise<RunResult> {
  const { settings: s, sink } = o;
  const startedAt = Date.now();
  let scrolls = 0;
  let idle = 0;
  let sawFromApi = 0;
  let sawFromDom = 0;
  let retried = false;
  const seenIds = new Set<string>();
  const result = (stop: StopReason): RunResult => ({
    stop,
    source: sawFromApi && sawFromDom ? 'mixed' : sawFromApi ? 'graphql' : sawFromDom ? 'dom' : 'none',
    sawFromApi,
    sawFromDom,
  });

  // the first payload of a profile was answered before the run started: read the cards already on screen
  const firstDom = scanDom();
  const initial = feed.take();
  const ingest = (posts: Post[], fromApi: boolean): StopReason | null => {
    if (!posts.length) return null;
    if (fromApi) sawFromApi += posts.length; else sawFromDom += posts.length;
    const fresh = sink.add(posts);
    posts.forEach((p) => seenIds.add(p.id));
    o.onProgress(sink.posts.size, fresh, fromApi ? '' : 'DOM fallback (fewer fields)');
    if (o.mode === 'incremental' && o.newestId) {
      const old = posts.find((p) => !p.is_pinned && compareIds(p.id, o.newestId) <= 0);
      if (old) return 'caught_up';
    }
    if (s.maxPosts > 0 && sink.posts.size >= s.maxPosts) return 'max_posts';
    return fresh > 0 ? null : null;
  };
  let stop = ingest(initial.length ? initial : firstDom, initial.length > 0);
  if (stop) return result(stop);

  while (true) {
    if (o.isStopped()) return result('stopped');
    if (handleFromPath(location.pathname) !== o.handle) return result('left_profile');
    if (s.maxMinutes > 0 && Date.now() - startedAt > s.maxMinutes * 60_000) return result('max_minutes');
    await whileVisible();

    const before = sink.posts.size;
    window.scrollBy(0, window.innerHeight * rand(0.8, 1.3));
    scrolls += 1;
    await sleep(rand(s.delayMinMs, s.delayMaxMs));

    if (feed.takeRateLimited() || errorCardShown()) {
      if (retried) return result('rate_limited');
      retried = true;
      o.onProgress(sink.posts.size, 0, 'rate limited: waiting 60 s, then Retry once');
      await sleep(60_000);
      const btn = retryButton();
      if (btn) btn.click();
      await sleep(rand(s.delayMinMs, s.delayMaxMs));
    }

    const fromApi = feed.take();
    stop = ingest(fromApi, true);
    if (stop) return result(stop);
    const apiSilent = Date.now() - feed.lastApiAt > 10_000;
    if (!fromApi.length && apiSilent) {
      const dom = scanDom().filter((p) => !seenIds.has(p.id));
      stop = ingest(dom, false);
      if (stop) return result(stop);
    }

    idle = sink.posts.size > before ? 0 : idle + 1;
    if (idle >= s.idleScrolls) return result('end_of_timeline');
    if (scrolls % s.restEvery === 0) {
      o.onProgress(sink.posts.size, 0, 'resting');
      await sleep(rand(s.restMinSec, s.restMaxSec) * 1000);
    }
  }
}
