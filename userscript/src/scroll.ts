/// <reference lib="esnext" />
// =========================================================================
// The run: scroll the profile timeline gently until a stop condition, feeding every captured post to
// the sink. The interceptor (installed at document-start by main.ts) calls `onTimeline` for each
// GraphQL response; when none arrived for 10 s the DOM fallback reads the rendered cards instead.
// Stop reasons: stopped (the Stop button), caught_up (incremental: an id <= the newest stored one),
// end_of_timeline (idleScrolls scrolls without a new post), max_posts and max_minutes (only when set, off by
// default: the owner wants a run to go on until the timeline ends or Stop is pressed), rate_limited
// (no longer produced: on HTTP 429 or the "Something went wrong" card the run waits and clicks Retry until posts return), left_profile (the url changed).
// =========================================================================
import { compareIds, handleFromPath, sameHandle, type Post } from '../../shared/post';
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

// X renders the "Something went wrong" card in the viewer's language (the owner's UI is Russian: "Что-то пошло не так",
// "Повторить попытку"), so the Retry button is found by its known labels and, failing that, by its place: a short
// button with an icon in the primary column after the last post card, outside every article.
const RETRY_WAIT_MIN = [1, 2, 5, 10, 15];
const RETRY_LABELS = /^(retry|try again|повторить попытку|повторить|reintentar|réessayer|erneut versuchen|riprova|tentar novamente|opnieuw proberen|spróbuj ponownie|yeniden dene|försök igen|prøv igen|再試行|重试|다시 시도)$/i;

function retryButton(): HTMLElement | null {
  const column = document.querySelector<HTMLElement>('[data-testid="primaryColumn"]') || document.body;
  const buttons = Array.from(column.querySelectorAll<HTMLElement>('[role="button"]')).filter((b) => !b.closest('article'));
  const byLabel = buttons.find((b) => RETRY_LABELS.test((b.textContent || '').trim()));
  if (byLabel) return byLabel;
  const articles = column.querySelectorAll('article');
  const last = articles[articles.length - 1];
  if (!last) return null;
  return buttons.find((b) => {
    const text = (b.textContent || '').trim();
    return text.length > 0 && text.length <= 40 && !!b.querySelector('svg') && !b.querySelector('a[href]')
      && (last.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }) || null;
}

const errorCardShown = (): boolean => retryButton() !== null;

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
  let retries = 0;          // consecutive Retry clicks, reset when posts arrive
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
    if (!sameHandle(handleFromPath(location.pathname) || '', o.handle)) return result('left_profile');
    if (s.maxMinutes > 0 && Date.now() - startedAt > s.maxMinutes * 60_000) return result('max_minutes');
    await whileVisible();

    const before = sink.posts.size;
    window.scrollBy(0, window.innerHeight * rand(0.8, 1.3));
    scrolls += 1;
    await sleep(rand(s.delayMinMs, s.delayMaxMs));

    if (feed.takeRateLimited() || errorCardShown()) {
      // deep in a long timeline X answers with HTTP 429 or the error card: the run never gives up on it (the
      // owner: keep clicking Retry until the posts come back or Stop is pressed); the wait grows 1, 2, 5, 10,
      // then 15 minutes between clicks, so a 15-minute rate-limit window passes with a couple of requests
      const minutes = RETRY_WAIT_MIN[Math.min(retries, RETRY_WAIT_MIN.length - 1)];
      retries += 1;
      o.onProgress(sink.posts.size, 0, `rate limited: waiting ${minutes} min, then Retry (attempt ${retries})`);
      const until = Date.now() + minutes * 60_000;
      while (Date.now() < until) {
        await sleep(1000);
        if (o.isStopped()) return result('stopped');
      }
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

    if (sink.posts.size > before) retries = 0;
    idle = sink.posts.size > before ? 0 : idle + 1;
    if (idle >= s.idleScrolls) {
      // the next page of a real timeline can take X a while (and a "Retry" card): before calling it the end,
      // three times scroll to the very bottom and wait 10 s for more; the owner's 2.3.7 run stopped at 495 posts
      let grew = false;
      for (let i = 0; i < 3 && !grew; i += 1) {
        o.onProgress(sink.posts.size, 0, `end of the timeline? waiting for more (${i + 1}/3)`);
        // the nudge that opening DevTools gives X by accident: a screen up, back to the bottom, a resize event -
        // the virtual list re-renders and asks for the next page again
        window.scrollBy(0, -window.innerHeight);
        await sleep(1000);
        window.scrollTo(0, document.body.scrollHeight);
        window.dispatchEvent(new Event('resize'));
        await sleep(10_000);
        if (o.isStopped()) return result('stopped');
        const btn = retryButton();
        if (btn) { btn.click(); await sleep(4000); }
        const late = feed.take();
        stop = ingest(late, true);
        if (stop) return result(stop);
        if (!late.length) {
          const dom = scanDom().filter((p) => !seenIds.has(p.id));
          stop = ingest(dom, false);
          if (stop) return result(stop);
        }
        grew = sink.posts.size > before;
      }
      if (!grew) return result('end_of_timeline');
      idle = 0;
    }
    if (scrolls % s.restEvery === 0) {
      o.onProgress(sink.posts.size, 0, 'resting');
      await sleep(rand(s.restMinSec, s.restMaxSec) * 1000);
    }
  }
}
