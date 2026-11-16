// Stamp sw.js with a content hash of every cached asset so installed apps pick up new versions.
// Usage: node tools/stamp-sw.mjs   (run from the repo root before committing a deploy)
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const sw = readFileSync('sw.js', 'utf8');
const list = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
const h = createHash('sha256');
for (const a of list) {
  const f = a === './' ? 'index.html' : a;
  if (!existsSync(f)) throw new Error(`sw.js lists a missing file: ${f}`);
  h.update(f).update(readFileSync(f));
}
const version = h.digest('hex').slice(0, 12);
writeFileSync('sw.js', sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`));
console.log('sw.js VERSION =', version);
