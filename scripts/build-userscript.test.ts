/// <reference types="bun" />
/// <reference types="node" />
import { describe, expect, test } from 'bun:test';
import { userscriptHeader } from '../userscript/header';

describe('userscript header', () => {
  const h = userscriptHeader('2.0.0');
  test('is a Tampermonkey block with the grants and hosts the code relies on', () => {
    expect(h.startsWith('// ==UserScript==\n')).toBe(true);
    expect(h.trim().endsWith('// ==/UserScript==')).toBe(true);
    ['GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_addValueChangeListener', 'GM_registerMenuCommand', 'unsafeWindow']
      .forEach((g) => expect(h).toContain(`// @grant        ${g}`));
    expect(h).toContain('// @match        https://x.com/*');
    expect(h).toContain('// @match        https://daggerok.github.io/twitter/*');
    expect(h).toContain('// @run-at       document-start');
    expect(h).toContain('// @version      2.0.0');
    expect(h).toContain('// @downloadURL  https://daggerok.github.io/twitter/x-sync.user.js');
    expect(h).not.toMatch(/token|secret|password/i);
  });
});
