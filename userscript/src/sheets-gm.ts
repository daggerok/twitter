/// <reference lib="esnext" />
// =========================================================================
// Direct writes from x.com to the Google Sheet with the token the viewer shared (Tampermonkey storage,
// key xsync.google, put there by the viewer page through the DOM, see bridge.ts). Sheets API v4 over
// GM_xmlhttpRequest. The tab is read once per run (id -> row), new posts are appended, known posts have
// their row rewritten (counts, last_seen_at; first_seen_at kept). The viewer's full sorted rewrite happens
// on its next merge; here the order of the tab does not matter, the viewer sorts.
// =========================================================================
import { firstRowOfRange, fromRow, isCredsFresh, LAST_COL, mergePosts, POST_HEADERS, quoteTab, rangeOf, tabOf, toRow, type GoogleCreds, type Post } from '../../shared/post';
import { gmGet, gmRequest, GOOGLE_KEY, hasGmRequest } from './gm';

const API = 'https://sheets.googleapis.com/v4';

export const loadCreds = (): GoogleCreds | null => {
  const c = gmGet<GoogleCreds | null>(GOOGLE_KEY, null);
  return isCredsFresh(c) ? c : null;
};

export class SheetError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function api<T>(creds: GoogleCreds, method: string, path: string, body?: unknown): Promise<T> {
  const r = await gmRequest(method, `${API}${path}`, { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' }, body === undefined ? undefined : JSON.stringify(body));
  let json: unknown = null;
  try { json = r.responseText ? JSON.parse(r.responseText) : null; } catch { /* not json */ }
  if (r.status < 200 || r.status >= 300) {
    const msg = (json as { error?: { message?: string } } | null)?.error?.message || r.responseText.slice(0, 200) || `HTTP ${r.status}`;
    throw new SheetError(`Sheets API ${r.status}: ${msg}`, r.status);
  }
  return json as T;
}

/** One account's tab for one run: knows which ids are on which row. */
export class DirectWriter {
  private rows = new Map<string, { row: number; post: Post }>();
  private nextRow = 2;
  private tab: string;
  ready = false;
  stored = 0;
  updated = 0;
  lastError = '';

  constructor(private readonly creds: GoogleCreds, readonly handle: string) {
    this.tab = tabOf(handle);
  }

  static available(): boolean {
    return hasGmRequest() && !!loadCreds();
  }

  /** Create the tab when missing, write the header, read every row. */
  async prepare(): Promise<void> {
    const id = this.creds.spreadsheetId;
    const meta = await api<{ sheets?: { properties?: { title?: string } }[] }>(this.creds, 'GET', `/spreadsheets/${id}?fields=sheets.properties.title`);
    const exists = (meta.sheets || []).some((s) => s.properties?.title === this.tab);
    if (!exists) {
      try {
        await api(this.creds, 'POST', `/spreadsheets/${id}:batchUpdate`, { requests: [{ addSheet: { properties: { title: this.tab, gridProperties: { frozenRowCount: 1 } } } }] });
      } catch (e) {
        if (!(e instanceof SheetError && e.status === 400)) throw e;
      }
    }
    await api(this.creds, 'PUT', `/spreadsheets/${id}/values/${rangeOf(this.tab, `A1:${LAST_COL}1`)}?valueInputOption=RAW`, { range: `${quoteTab(this.tab)}!A1:${LAST_COL}1`, majorDimension: 'ROWS', values: [Array.from(POST_HEADERS)] });
    const r = await api<{ values?: unknown[][] }>(this.creds, 'GET', `/spreadsheets/${id}/values/${rangeOf(this.tab, `A2:${LAST_COL}`)}`);
    const values = r.values || [];
    values.forEach((row, i) => {
      const p = fromRow(row);
      if (p) this.rows.set(p.id, { row: i + 2, post: p });
    });
    this.nextRow = values.length + 2;
    this.ready = true;
  }

  /** Known ids get their row rewritten, new ones are appended; returns what was written. */
  async write(posts: Post[]): Promise<{ inserted: number; updated: number }> {
    if (!posts.length) return { inserted: 0, updated: 0 };
    const id = this.creds.spreadsheetId;
    const updates: { range: string; values: string[][] }[] = [];
    const fresh: Post[] = [];
    const seen = new Set<string>();
    posts.forEach((p) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      const known = this.rows.get(p.id);
      if (known) {
        const merged = mergePosts([known.post], [p]).posts[0];
        known.post = merged;
        updates.push({ range: `${quoteTab(this.tab)}!A${known.row}:${LAST_COL}${known.row}`, values: [toRow(merged)] });
      } else {
        fresh.push(p);
      }
    });
    if (updates.length) {
      await api(this.creds, 'POST', `/spreadsheets/${id}/values:batchUpdate`, { valueInputOption: 'RAW', data: updates.map((u) => ({ range: u.range, majorDimension: 'ROWS', values: u.values })) });
    }
    if (fresh.length) {
      const res = await api<{ updates?: { updatedRange?: string } }>(this.creds, 'POST', `/spreadsheets/${id}/values/${rangeOf(this.tab, `A1:${LAST_COL}1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { range: `${quoteTab(this.tab)}!A1:${LAST_COL}1`, majorDimension: 'ROWS', values: fresh.map(toRow) });
      const first = firstRowOfRange(res.updates?.updatedRange || '') || this.nextRow;
      fresh.forEach((p, i) => this.rows.set(p.id, { row: first + i, post: p }));
      this.nextRow = first + fresh.length;
    }
    this.stored += fresh.length;
    this.updated += updates.length;
    return { inserted: fresh.length, updated: updates.length };
  }

  get count(): number { return this.rows.size; }
}
