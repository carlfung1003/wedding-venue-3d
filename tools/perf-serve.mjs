/* PERF SERVE (KAN-235) — a local stand-in for Vercel's edge, for LOAD measurements.

     node tools/perf-serve.mjs <root> <port>        # https://127.0.0.1:<port>/

   serve.py is the dev server and sends `no-store` — right for editing, wrong
   for measuring a cold load, because production does three things it does not:
     · HTTP/2. ~150 requests over HTTP/1.1's six connections serialise behind
       the emulated latency (+10 s at Slow 4G that production never pays);
     · brotli on text AND on model/gltf-binary (checked on venue.carlfung.dev:
       `content-encoding: br` on .js/.css/.json/.glb, none on .webp/.woff2);
     · `cache-control: public, max-age=0, must-revalidate` + ETag → 304s on a
       warm reload — unless vercel.json says otherwise, whose `headers` rules
       are applied here too (source patterns: literal paths, `(.*)` and
       `/:path*` only — enough for this repo's file).
   TLS is self-signed (generated once into $TMPDIR/venue-perf-cert); launch
   Chromium with --ignore-certificate-errors. Brotli quality 4 by default
   (PERF_BR_Q): production serves main.js at 11,147 B, q4 10,913, q5 10,297 —
   the edge compresses on the fly, a little under q4. */
import http2 from 'node:http2';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { brotliCompressSync, constants as Z } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROOT = process.argv[2] || '.';
const PORT = +(process.argv[3] || 8830);
const BRQ = +(process.env.PERF_BR_Q || 4);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.txt': 'text/plain',
};
const COMPRESS = /^(text\/|application\/(javascript|json|wasm)|image\/svg|model\/gltf)/;

const certDir = process.env.PERF_CERT_DIR || join(tmpdir(), 'venue-perf-cert');
if (!existsSync(join(certDir, 'cert.pem'))) {
  mkdirSync(certDir, { recursive: true });
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 60 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`, { cwd: certDir, stdio: 'ignore' });
}

/* vercel.json `headers` → [{ re, headers }] */
function vercelRules() {
  const f = join(ROOT, 'vercel.json');
  if (!existsSync(f)) return [];
  const cfg = JSON.parse(readFileSync(f, 'utf8'));
  return (cfg.headers || []).map(h => {
    let src = h.source.replace(/\/:path\*/g, '(?:/.*)?').replace(/\./g, '\\.').replace(/\\\.\*/g, '.*');
    return { re: new RegExp('^' + src + '$'), headers: h.headers };
  });
}
const RULES = vercelRules();

const cache = new Map();   // path -> { body, br, etag, type }
function load(p) {
  const mt = statSync(p).mtimeMs;
  if (cache.has(p) && cache.get(p).mt === mt) return cache.get(p);
  const body = readFileSync(p);
  const type = TYPES[extname(p).toLowerCase()] || 'application/octet-stream';
  const br = COMPRESS.test(type) && body.length > 512
    ? brotliCompressSync(body, { params: { [Z.BROTLI_PARAM_QUALITY]: BRQ, [Z.BROTLI_PARAM_SIZE_HINT]: body.length } })
    : null;
  const etag = 'W/"' + createHash('md5').update(body).digest('hex') + '"';
  const e = { body, br, etag, type, mt };
  cache.set(p, e);
  return e;
}

const server = http2.createSecureServer({
  key: readFileSync(join(certDir, 'key.pem')), cert: readFileSync(join(certDir, 'cert.pem')),
  allowHTTP1: true,
}, (req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.endsWith('/')) url += 'index.html';
  const p = normalize(join(ROOT, url));
  if (!p.startsWith(normalize(ROOT)) || !existsSync(p) || !statSync(p).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404'); return;
  }
  const e = load(p);
  const h = { 'content-type': e.type, 'cache-control': 'public, max-age=0, must-revalidate', etag: e.etag };
  for (const r of RULES) if (r.re.test(url)) for (const { key, value } of r.headers) h[key.toLowerCase()] = value;
  if (req.headers['if-none-match'] === e.etag) { res.writeHead(304, h); res.end(); return; }
  const wantsBr = /\bbr\b/.test(req.headers['accept-encoding'] || '');
  if (e.br && wantsBr) { h['content-encoding'] = 'br'; h['content-length'] = e.br.length; res.writeHead(200, h); res.end(e.br); }
  else { h['content-length'] = e.body.length; res.writeHead(200, h); res.end(e.body); }
});
server.listen(PORT, '127.0.0.1', () => console.log(`perf-serve ${ROOT} → https://127.0.0.1:${PORT}/ (br q${BRQ}, ${RULES.length} vercel.json rules)`));
