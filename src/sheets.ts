/// <reference lib="esnext" />
// =========================================================================
// Google Sheets API v4 calls of the viewer (the youtube repo's helpers, typed, with the posts layout).
// One tab per account: `X-<handle>`, header row = POST_HEADERS, one row per post, newest first.
// Writes are "overwrite rows 2..n+1, then clear the tail" so a failed PUT leaves the old rows in place.
// =========================================================================
import { fromRow, LAST_COL, POST_HEADERS, quoteTab, rangeOf as range, toRow, type Post } from '../shared/post';
import { googleFetch } from './gis';

export { handleOfTab, tabOf, TAB_PREFIX } from '../shared/post';
const API = 'https://sheets.googleapis.com/v4';

/** Spreadsheet id from a pasted url or a bare id. */
export function spreadsheetId(v: string): string {
  const t = (v || '').trim();
  if (!t) return '';
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(t);
  return m ? m[1] : t.replace(/\/edit.*$/, '');
}

export const spreadsheetUrl = (id: string): string => `https://docs.google.com/spreadsheets/d/${id}/edit`;


type Meta = { sheets?: { properties?: { title?: string; sheetId?: number; gridProperties?: { rowCount?: number } } }[]; properties?: { title?: string } };

export type TabInfo = { title: string; sheetId: number; rows: number };

export async function listTabs(token: string, id: string): Promise<{ title: string; tabs: TabInfo[] }> {
  const m = await googleFetch<Meta>(`${API}/spreadsheets/${id}?fields=properties.title,sheets.properties(title,sheetId,gridProperties.rowCount)`, token);
  const tabs = (m.sheets || []).map((s) => ({ title: s.properties?.title || '', sheetId: s.properties?.sheetId ?? -1, rows: s.properties?.gridProperties?.rowCount ?? 0 })).filter((t) => t.title);
  return { title: m.properties?.title || '', tabs };
}

export async function ensureTab(token: string, id: string, tab: string): Promise<void> {
  const { tabs } = await listTabs(token, id);
  if (!tabs.some((t) => t.title === tab)) {
    try {
      await googleFetch(`${API}/spreadsheets/${id}:batchUpdate`, token, {
        method: 'POST',
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab, gridProperties: { frozenRowCount: 1 } } } }] }),
      });
    } catch (e) {
      // a concurrent call may have added the tab already; auth and server errors must surface
      if (!(e instanceof Error && 'status' in e && (e as { status: number }).status === 400)) throw e;
    }
  }
  const header = range(tab, `A1:${LAST_COL}1`);
  await googleFetch(`${API}/spreadsheets/${id}/values/${header}?valueInputOption=RAW`, token, {
    method: 'PUT',
    body: JSON.stringify({ range: `${quoteTab(tab)}!A1:${LAST_COL}1`, majorDimension: 'ROWS', values: [Array.from(POST_HEADERS)] }),
  });
}

export async function readPosts(token: string, id: string, tab: string): Promise<Post[]> {
  const r = await googleFetch<{ values?: unknown[][] }>(`${API}/spreadsheets/${id}/values/${range(tab, `A2:${LAST_COL}`)}`, token);
  const out: Post[] = [];
  (r.values || []).forEach((row) => {
    const p = fromRow(row);
    if (p) out.push(p);
  });
  return out;
}

/**
 * Overwrite rows 2..n+1 in one PUT (RAW keeps the ids as text, the grid grows as needed), then clear only the rows that
 * exist past the end: a clear range beyond the grid is a 400 "exceeds grid limits" (seen with 1,866 posts on a 1,624 row tab).
 */
export async function writePosts(token: string, id: string, tab: string, posts: Post[]): Promise<void> {
  const rows = posts.map(toRow);
  if (rows.length) {
    const cells = `A2:${LAST_COL}${rows.length + 1}`;
    await googleFetch(`${API}/spreadsheets/${id}/values/${range(tab, cells)}?valueInputOption=RAW`, token, {
      method: 'PUT',
      body: JSON.stringify({ range: `${quoteTab(tab)}!${cells}`, majorDimension: 'ROWS', values: rows }),
    });
  }
  const { tabs } = await listTabs(token, id);
  const gridRows = tabs.find((t) => t.title === tab)?.rows ?? 0;
  if (gridRows > rows.length + 1) {
    await googleFetch(`${API}/spreadsheets/${id}/values/${range(tab, `A${rows.length + 2}:${LAST_COL}${gridRows}`)}:clear`, token, { method: 'POST', body: '{}' });
  }
}

/** One post changed in the viewer (hidden): rewrite only its row, found by the id column, or append it. Other rows stay. */
export async function writePostRow(token: string, id: string, tab: string, post: Post): Promise<void> {
  const r = await googleFetch<{ values?: unknown[][] }>(`${API}/spreadsheets/${id}/values/${range(tab, 'A2:A')}`, token);
  const index = (r.values || []).findIndex((cells) => String(cells && cells[0] !== undefined ? cells[0] : '') === post.id);
  const row = toRow(post);
  if (index === -1) {
    await googleFetch(`${API}/spreadsheets/${id}/values/${range(tab, `A1:${LAST_COL}1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, token, {
      method: 'POST',
      body: JSON.stringify({ range: `${quoteTab(tab)}!A1:${LAST_COL}1`, majorDimension: 'ROWS', values: [row] }),
    });
    return;
  }
  const cells = `A${index + 2}:${LAST_COL}${index + 2}`;
  await googleFetch(`${API}/spreadsheets/${id}/values/${range(tab, cells)}?valueInputOption=RAW`, token, {
    method: 'PUT',
    body: JSON.stringify({ range: `${quoteTab(tab)}!${cells}`, majorDimension: 'ROWS', values: [row] }),
  });
}

export async function deleteTab(token: string, id: string, sheetId: number): Promise<void> {
  await googleFetch(`${API}/spreadsheets/${id}:batchUpdate`, token, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteSheet: { sheetId } }] }),
  });
}

export async function createSpreadsheet(token: string, title: string): Promise<{ id: string; url: string }> {
  const res = await googleFetch<{ spreadsheetId?: string; spreadsheetUrl?: string }>(`${API}/spreadsheets`, token, {
    method: 'POST',
    body: JSON.stringify({ properties: { title: title.trim() || 'X Feed Sheets' }, sheets: [{ properties: { title: 'README' } }] }),
  });
  if (!res.spreadsheetId) throw new Error('Failed to create the spreadsheet');
  return { id: res.spreadsheetId, url: res.spreadsheetUrl || spreadsheetUrl(res.spreadsheetId) };
}
