/// <reference types="bun" />
/// <reference types="node" />
// Bundles userscript/src/main.ts into one file with the Tampermonkey header: dist/x-sync.user.js.
// Run by `postbuild` (so the Pages site serves the script next to the viewer) and by `bun run userscript`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { userscriptHeader, USERSCRIPT_FILE } from '../userscript/header';

async function main(): Promise<void> {
  const root = join(__dirname, '..');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  const result = await Bun.build({
    entrypoints: [join(root, 'userscript/src/main.ts')],
    target: 'browser',
    format: 'iife',
    minify: false,
    sourcemap: 'none',
  });
  if (!result.success) {
    result.logs.forEach((l) => console.error(String(l)));
    throw new Error('userscript bundle failed');
  }
  const code = await result.outputs[0].text();
  const out = userscriptHeader(pkg.version) + code;
  mkdirSync(join(root, 'dist'), { recursive: true });
  const file = join(root, 'dist', USERSCRIPT_FILE);
  writeFileSync(file, out);
  console.log(`${file}: ${out.length} bytes, version ${pkg.version}`);
}

main().catch((err: unknown) => { console.error(err); process.exitCode = 1; });
