/// <reference lib="esnext" />
// The Tampermonkey header of dist/x-sync.user.js (scripts/build-userscript.ts puts it in front of the bundle).
export const PAGES_URL = 'https://daggerok.github.io/twitter/';
export const USERSCRIPT_FILE = 'x-sync.user.js';

export function userscriptHeader(version: string): string {
  return [
    '// ==UserScript==',
    '// @name         X -> Google Sheets sync (daggerok/twitter)',
    '// @namespace    https://daggerok.github.io/twitter/',
    `// @version      ${version}`,
    '// @description  Collects the posts of an X profile while you scroll it in your own logged-in browser and hands them to the daggerok/twitter viewer, which stores them in your Google Sheet.',
    '// @author       daggerok',
    `// @homepageURL  ${PAGES_URL}`,
    '// @supportURL   https://github.com/daggerok/twitter/issues',
    `// @updateURL    ${PAGES_URL}${USERSCRIPT_FILE}`,
    `// @downloadURL  ${PAGES_URL}${USERSCRIPT_FILE}`,
    '// @match        https://x.com/*',
    '// @match        https://twitter.com/*',
    `// @match        ${PAGES_URL}*`,
    '// @include      http://localhost:*/*',
    '// @include      http://127.0.0.1:*/*',
    '// @run-at       document-start',
    '// @sandbox      raw',
    '// @noframes',
    '// @grant        GM_getValue',
    '// @grant        GM_setValue',
    '// @grant        GM_deleteValue',
    '// @grant        GM_addValueChangeListener',
    '// @grant        GM_registerMenuCommand',
    '// @grant        unsafeWindow',
    '// @grant        GM_xmlhttpRequest',
    '// @connect      sheets.googleapis.com',
    '// ==/UserScript==',
    '',
  ].join('\n');
}
