/* THE CHINESE SERIF SUBSETS (KAN-232) — re-cut the two self-hosted woff2s to
   exactly the CJK glyphs the venue uses:
     assets/fonts/venue-serif-tc.woff2       every CJK glyph in the copy (the
                                             Chinese page; html[data-lang=zh] only)
     assets/fonts/venue-serif-tc-mini.woff2  only the glyphs in the ENGLISH copy
                                             (隱逸居, the cocktail's name) — so an
                                             English guest never downloads the
                                             Chinese face for a handful of characters

     node tools/cjk-subset.mjs            re-cut + verify
     node tools/cjk-subset.mjs --check    verify only (exit 1 if a glyph is missing)

   Reads every CJK character (and full-width punctuation) in the STRINGS of
   js/i18n.js, js/config.js and index.html (comments stripped), asks Google
   Fonts for Noto Serif TC 500 cut to that `text=`, saves the woff2 locally
   (self-hosted: fonts.googleapis.com is unreachable from the mainland), then
   opens it with fontTools and checks every character has a glyph. Run it after
   ANY change to Chinese copy — a missing glyph falls back to the system serif
   mid-word, silently. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SOURCES = ['js/i18n.js', 'js/config.js', 'index.html'];
/* CJK ideographs, CJK punctuation, full-width forms */
const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/u;
/* comments carry Simplified forms on purpose (隐逸居 — "never this"), so they
   are stripped: only copy is cut into the font */
const uncomment = (src, f) => f.endsWith('.html')
  ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
const cjkOf = s => { const o = new Set(); for (const ch of s) if (CJK.test(ch)) o.add(ch); return o; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const all = new Set();
for (const f of SOURCES) for (const ch of cjkOf(uncomment(read(f), f))) all.add(ch);
const i18n = uncomment(read('js/i18n.js'), '.js');
const mini = cjkOf(i18n.slice(i18n.indexOf('\n  en: {'), i18n.indexOf('\n  zh: {')));
for (const ch of cjkOf(i18n.match(/const CJK = '([^']*)'/)?.[1] || '')) mini.add(ch);

const FILES = [
  { out: path.join(ROOT, 'assets/fonts/venue-serif-tc.woff2'), text: [...all].sort().join('') },
  { out: path.join(ROOT, 'assets/fonts/venue-serif-tc-mini.woff2'), text: [...mini].sort().join('') },
];
for (const F of FILES) console.log(`${path.basename(F.out)}: ${F.text.length} characters${F.text.length < 40 ? ' (' + F.text + ')' : ''}`);

function verify({ out, text }) {
  const py = `
import sys
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1]); cmap = f.getBestCmap()
miss = [c for c in sys.argv[2] if ord(c) not in cmap]
print(len(cmap), ''.join(miss))
`;
  const res = execFileSync('python3', ['-c', py, out, text], { encoding: 'utf8' }).trim().split(' ');
  const missing = res[1] || '';
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`${out.replace(ROOT + '/', '')}: ${kb} KB, ${res[0]} glyphs mapped, missing: ${missing || 'none'}`);
  return !missing;
}

if (process.argv.includes('--check')) process.exit(FILES.every(verify) ? 0 : 1);

/* a woff2-capable UA so Google answers with woff2 */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
let ok = true;
for (const F of FILES) {
  const cssURL = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500&display=swap&text=' + encodeURIComponent(F.text);
  const css = await (await fetch(cssURL, { headers: { 'User-Agent': UA } })).text();
  const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
  if (urls.length !== 1) { console.error('expected ONE font file for a text= request, got', urls.length, '\n', css); process.exit(1); }
  const buf = Buffer.from(await (await fetch(urls[0], { headers: { 'User-Agent': UA } })).arrayBuffer());
  fs.mkdirSync(path.dirname(F.out), { recursive: true });
  fs.writeFileSync(F.out, buf);
  ok = verify(F) && ok;
}
process.exit(ok ? 0 : 1);
