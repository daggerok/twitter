/// <reference lib="esnext" />
// =========================================================================
// The first page of a profile timeline no longer comes as a request: since Nov 2026 X renders it on the server and
// streams the GraphQL answers inside the page's own HTML, as inline scripts of the form
//   ...result:$R[44]={kind:"Result.Ok",value:"{\"data\":{\"user_result_by_screen_name\":{...}}}"}...
// (a JavaScript string literal holding the JSON text; the script removes itself after it ran). The interceptor never
// sees these, so every freshly loaded profile used to be read from the rendered cards (wrong kinds, rounded counts).
// `ssrPayloads` pulls those answers out of the HTML text; `fetchSsrPayloads` asks X for the page the tab shows.
// =========================================================================

const MARKER = '"{\\"data\\"';

/** Every GraphQL answer embedded in a page's HTML (or in one inline script), parsed. A literal that does not parse is skipped. */
export function ssrPayloads(html: string): unknown[] {
  const out: unknown[] = [];
  let from = 0;
  while (from < html.length) {
    const at = html.indexOf(MARKER, from);
    if (at < 0) break;
    // walk to the closing quote of the string literal, stepping over escaped characters
    let i = at + 1;
    while (i < html.length && html[i] !== '"') i += html[i] === '\\' ? 2 : 1;
    const literal = html.slice(at + 1, i);
    from = i + 1;
    try {
      // a JS string literal is JSON but for \xNN (the serializer writes `<` as \x3C so the markup never closes the script)
      const text: unknown = JSON.parse(`"${literal.replace(/\\x([0-9A-Fa-f]{2})/g, '\\u00$1')}"`);
      if (typeof text === 'string') out.push(JSON.parse(text));
    } catch { /* not a GraphQL answer after all */ }
  }
  return out;
}

/** The answers X renders into the page at `path` (the same document the browser loaded, asked once more). [] on any failure. */
export async function fetchSsrPayloads(path: string): Promise<unknown[]> {
  try {
    const r = await fetch(path, { credentials: 'include', headers: { Accept: 'text/html' } });
    if (!r.ok) return [];
    return ssrPayloads(await r.text());
  } catch {
    return [];
  }
}
