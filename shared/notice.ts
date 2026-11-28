/// <reference lib="esnext" />
// =========================================================================
// Notifications of the userscript's runs, the fidelity-accounts way (owner 2026-11-28: "notify view app when we pushed
// data into google sheets", "add notification with settings", "like we have in fidelity accounts"; the write signal
// itself is shared/written.ts):
// - one switch 🔔 in Tampermonkey storage (NOTIFY_KEY, off by default), set from the viewer's Setup or the badge's ⚙.
//   While it is on, each finished run or failed write gives ONE notification: the x.com tab leaves the newest notice
//   for the viewer (NOTICE_KEY), which shows it as a popup, and sends a browser notification only when no viewer is on
//   screen. A visible viewer tab says so with a heartbeat (VIEWER_KEY, every VIEWER_BEAT_MS while visible)
// The rules are here, pure; the userscript and the viewer only call them.
// =========================================================================

export const NOTIFY_KEY = 'xsync.notify';     // boolean, off when missing
export const NOTICE_KEY = 'xsync.notice';     // the newest Notice
export const VIEWER_KEY = 'xsync.viewerSeen'; // ms of the last heartbeat of a visible viewer tab

export const NOTICE_OK_MS = 10_000;          // a success closes by itself, an error stays until closed
export const NOTICE_CLICK_AWAY_MS = 2_000;   // a click elsewhere closes a popup shown at least this long
export const NOTICE_MAX_AGE_MS = 60_000;     // an older notice is not shown when a viewer opens later
export const VIEWER_BEAT_MS = 20_000;

export type NoticeLevel = 'ok' | 'error';
/** `lines`: one fact a line, the first is the title (what happened), the rest its numbers or the error. */
export type Notice = { at: number; level: NoticeLevel; lines: string[] };

export const makeNotice = (level: NoticeLevel, lines: readonly string[], at: number): Notice =>
  ({ at, level, lines: lines.map((l) => l.trim().slice(0, 200)).filter(Boolean).slice(0, 6) });

/** A notice worth showing now: well formed and fresh. */
export function freshNotice(raw: unknown, now: number): Notice | null {
  const n = raw as Partial<Notice> | null;
  if (!n || typeof n !== 'object' || typeof n.at !== 'number' || (n.level !== 'ok' && n.level !== 'error') || !Array.isArray(n.lines)) return null;
  if (!(now - n.at >= 0 && now - n.at < NOTICE_MAX_AGE_MS)) return null;
  const made = makeNotice(n.level, n.lines.filter((l): l is string => typeof l === 'string'), n.at);
  return made.lines.length ? made : null;
}

const sameText = (a: Notice, b: Notice): boolean => a.level === b.level && a.lines.join('\n') === b.lines.join('\n');

/** The popups on screen: the new one last, at most `max`; a notice that says what one on screen says takes its place. */
export const pushNotice = (list: readonly Notice[], n: Notice, max = 3): Notice[] => list.filter((x) => !sameText(x, n)).concat(n).slice(-max);

/** A viewer is on screen: its heartbeat is younger than two beats. A missing, broken or future time is not (then the browser notification goes out). */
export const viewerOnScreen = (seen: unknown, now: number): boolean => typeof seen === 'number' && seen <= now && now - seen < 2 * VIEWER_BEAT_MS;

/** A click on the page closes the popup: not a click inside it, and not in its first NOTICE_CLICK_AWAY_MS. */
export const clickCloses = (inside: boolean, shownForMs: number): boolean => !inside && shownForMs >= NOTICE_CLICK_AWAY_MS;

export type RunFacts = {
  handle: string;
  posts: number;          // posts read by the run
  inserted: number;       // new rows written to the sheet from x.com
  updated: number;        // known rows rewritten
  direct: boolean;        // the run wrote the sheet itself (a Google token was shared)
  stop: string;           // stop reason, as stored (`caught_up`)
  error: string;          // a failed write or a run error, '' when none
  auto: boolean;          // started by Watch, not by hand
};

const plural = (n: number, one: string, many = `${one}s`): string => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * What a finished run says, or null when it is not worth a notification: a Watch check that found nothing new (it
 * runs every few minutes and always rereads the first page). One fact a line, the title first.
 */
export function runNotice(f: RunFacts): { level: NoticeLevel; lines: string[] } | null {
  const who = `@${f.handle}`;
  if (f.error) {
    return { level: 'error', lines: [f.direct ? 'Google Sheets update failed' : 'X sync failed', `${who}: ${f.error}`, f.posts ? `${plural(f.posts, 'post')} wait for the viewer` : ''] };
  }
  if (f.auto && f.inserted === 0) return null;
  const ended = `Run ended: ${f.stop.replace(/_/g, ' ')}`;
  if (!f.direct) return { level: 'ok', lines: ['X posts collected', `${who}: ${plural(f.posts, 'post')} read`, f.posts ? 'Open the viewer to store them' : '', ended] };
  return { level: 'ok', lines: ['Google Sheets updated', `${who}: ${plural(f.posts, 'post')} read`, `${plural(f.inserted, 'new row')}, ${f.updated.toLocaleString('en-US')} updated`, ended] };
}

/**
 * What moved between two draws of the stacked popups: for every item that was there before and now stands somewhere
 * else, how far it has to be shifted to start from its old place and slide into the new one. A new item or one that
 * did not move is not in the answer.
 */
export function moved(before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>): { key: string; from: number }[] {
  const out: { key: string; from: number }[] = [];
  after.forEach((top, key) => {
    const old = before.get(key);
    if (old !== undefined && Math.abs(old - top) >= 1) out.push({ key, from: old - top });
  });
  return out;
}
