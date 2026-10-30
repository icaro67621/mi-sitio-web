#!/usr/bin/env node
/*
 * Servidor LOCAL del laboratorio de APIs (sin Azure, sin instalar nada).
 * Sirve la API en /api/lab/... y las páginas del sitio, para practicar en
 * tu propio ordenador de forma aislada.
 *
 * Uso:
 *   node tools/api-lab-server.js vuln      # API vulnerable
 *   node tools/api-lab-server.js clean     # API endurecida
 *   node tools/api-lab-server.js           # la que esté activa en api/lab
 *
 * Luego abre http://localhost:7071/ciberseguridad/api-lab/
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULES = {
  vuln: 'labs/api-lab/vuln/index.js',
  clean: 'labs/api-lab/clean/index.js',
  active: 'api/lab/index.js',
};
const which = { vulnerable: 'vuln', endurecida: 'clean', limpia: 'clean' }[process.argv[2]] || process.argv[2] || 'active';
if (!MODULES[which]) { console.error('Uso: node tools/api-lab-server.js vuln|clean'); process.exit(2); }
const handler = require(path.join(ROOT, MODULES[which]));
const PORT = Number(process.env.PORT) || 7071;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function serveStatic(url, res) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  const blocked = /^\/(api|labs|tools|\.git|\.github)(\/|$)/.test(p) || /\.(md|sh)$/.test(p);
  if (!file.startsWith(ROOT + path.sep) || blocked || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const m = url.pathname.match(/^\/api\/lab(?:\/(.*))?$/);
  if (!m) return serveStatic(url, res);

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const rawBody = Buffer.concat(chunks).toString('utf8');
    let body = rawBody;
    if (/json/i.test(req.headers['content-type'] || '')) { try { body = JSON.parse(rawBody); } catch { /* se deja como texto */ } }
    const fnReq = {
      method: req.method,
      url: url.href,
      headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress },
      query: Object.fromEntries(url.searchParams),
      params: { rest: m[1] || '' },
      body,
      rawBody,
    };
    const context = { log: Object.assign((...a) => console.log(...a), { error: (...a) => console.error(...a) }) };
    try {
      await handler(context, fnReq);
      const r = context.res || { status: 204 };
      res.writeHead(r.status || 200, r.headers || {});
      res.end(r.body || '');
    } catch (e) {
      console.error(e);
      res.writeHead(500); res.end('Error del servidor local');
    }
    console.log(req.method, url.pathname + url.search, '→', (context.res || {}).status);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('VulnBank API (' + handler.VERSION + ') escuchando en http://localhost:' + PORT);
  console.log('  Página del lab:  http://localhost:' + PORT + '/ciberseguridad/api-lab/');
  console.log('  API:             http://localhost:' + PORT + '/api/lab/');
  console.log('Ctrl+C para detener.');
});
