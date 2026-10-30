/*
 * VulnBank API · versión VULNERABLE (laboratorio de seguridad en APIs)
 * ---------------------------------------------------------------------
 * ESTE CÓDIGO ES INSEGURO A PROPÓSITO. Sirve para practicar el OWASP API
 * Security Top 10. Todos los datos, contraseñas y "secretos" son FICTICIOS
 * y viven solo en memoria: no hay base de datos, ni red interna real, ni
 * peticiones salientes (el SSRF está simulado).
 *
 * Cada fallo está marcado con un comentario  // [V#]  que coincide con el
 * manual del laboratorio.
 */
const crypto = require('crypto');

const VERSION = 'vulnerable';

// [V9] Secreto de firma débil y hardcodeado (además se filtra en /debug).
const JWT_SECRET = 'vulnbank';

// ---------------------------------------------------------------------
// Datos semilla (ficticios). POST /api/lab/reset los restaura.
// ---------------------------------------------------------------------
function seed() {
  const users = [
    { id: 1001, username: 'laura', password: 'Laura2026!', fullName: 'Laura Gómez', email: 'laura@vulnbank.example', phone: '+34 600 111 222', dni: '00000001R', pin: '4821', role: 'customer', accountId: 5001 },
    { id: 1002, username: 'carlos', password: '123456', fullName: 'Carlos Ruiz', email: 'carlos@vulnbank.example', phone: '+34 600 333 444', dni: '00000002W', pin: '1234', role: 'customer', accountId: 5002 },
    { id: 1003, username: 'admin', password: 'Adm1n!VulnB4nk#2026', fullName: 'Administración VulnBank', email: 'admin@vulnbank.example', phone: '+34 600 999 000', dni: '00000003A', pin: '0000', role: 'admin', accountId: 5003 },
  ];
  // [V4] Se guarda un hash MD5 sin sal (y además se expone en las respuestas).
  users.forEach((u) => { u.passwordHash = crypto.createHash('md5').update(u.password).digest('hex'); });
  const accounts = [
    { id: 5001, ownerId: 1001, iban: 'ES00 0000 0000 0000 0000 5001', balance: 2450.75, currency: 'EUR' },
    { id: 5002, ownerId: 1002, iban: 'ES00 0000 0000 0000 0000 5002', balance: 18320.40, currency: 'EUR' },
    { id: 5003, ownerId: 1003, iban: 'ES00 0000 0000 0000 0000 5003', balance: 999999.99, currency: 'EUR' },
  ];
  return { users, accounts };
}
let db = seed();

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const b64u = (s) => Buffer.from(s).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url').toString('utf8');

function signJwt(payload) {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}

function verifyJwt(token) {
  const [h, p, s] = String(token).split('.');
  const header = JSON.parse(fromB64u(h));
  const payload = JSON.parse(fromB64u(p));
  // [V2] Se acepta "alg": "none": un token SIN firma se da por válido.
  if (String(header.alg).toLowerCase() === 'none') return payload;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + p).digest('base64url');
  if (s !== expected) return null;
  // [V2] No se comprueba la caducidad (exp): el token vale para siempre.
  return payload;
}

// [V11] "Motor de consultas" estilo NoSQL: si el valor es un objeto, se
// interpreta como operador ($ne, $gt, $regex...). La entrada del usuario
// llega aquí sin validar su tipo.
function matches(doc, query) {
  return Object.entries(query).every(([k, v]) => {
    if (v && typeof v === 'object') {
      if ('$ne' in v) return doc[k] !== v.$ne;
      if ('$gt' in v) return doc[k] > v.$gt;
      if ('$regex' in v) return new RegExp(v.$regex).test(doc[k]);
    }
    return doc[k] === v;
  });
}

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (!req.rawBody) return {};
  return JSON.parse(req.rawBody); // [V9] si el JSON es inválido, explota con traza
}

function currentUser(req) {
  // El token va en la cabecera X-Auth-Token. (Azure Static Web Apps reserva
  // la cabecera Authorization para su propio login y la reemplaza; se acepta
  // también "Authorization: Bearer" para el servidor local.)
  const auth = req.headers.authorization || '';
  const token = req.headers['x-auth-token'] || (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;
  // Se confía en el contenido del token tal cual.
  return db.users.find((u) => u.id === payload.sub) || null;
}

function transactionsFor(accountId, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: accountId * 100000 + i, date: new Date(Date.UTC(2026, 0, 1) + i * 3600e3).toISOString(), concept: ['Supermercado', 'Nómina', 'Gasolinera', 'Restaurante', 'Bizum'][i % 5], amount: Number((((i * 37) % 500) - 120.5).toFixed(2)) });
  }
  return out;
}

// [V8] SSRF SIMULADO: no se hace ninguna petición real; se devuelven
// respuestas ficticias que imitan lo que vería un atacante.
function simulatedFetch(rawUrl) {
  const u = new URL(rawUrl);
  if (u.hostname === '169.254.169.254') {
    return { status: 200, simulated: true, body: { note: 'Respuesta SIMULADA de un servicio de metadatos cloud', accessKeyId: 'FAKE-AKIA-LAB-0000', secretAccessKey: 'FAKE-lab-secret-no-funciona', token: 'FAKE-session-token' } };
  }
  if (['localhost', '127.0.0.1', 'internal-admin.vulnbank.local'].includes(u.hostname)) {
    return { status: 200, simulated: true, body: { note: 'Respuesta SIMULADA de un panel interno', panel: 'VulnBank Admin (solo red interna)', backups: ['db-2026-10-01.sql.gz'], dbUser: 'root', dbPassword: 'FAKE-Root!Pass' } };
  }
  return { status: 200, simulated: true, body: { title: 'Vista previa de ' + u.hostname, description: 'En el laboratorio no se realizan peticiones reales.' } };
}

// ---------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------
async function route(req, path, method) {
  const q = req.query || {};
  let m;

  if (path === '' && method === 'GET') {
    return [200, { api: 'VulnBank API', version: VERSION, endpoints: ['POST /api/lab/auth/login', 'GET /api/lab/users/me', 'PATCH /api/lab/users/me', 'GET /api/lab/accounts/{id}', 'GET /api/lab/accounts/{id}/transactions?limit=20', 'POST /api/lab/transfers', 'GET /api/lab/admin/users', 'GET /api/lab/tools/preview?url=', 'POST /api/lab/reset', 'GET /api/lab/version'] }];
  }
  if (path === 'version' && method === 'GET') return [200, { lab: 'VulnBank API', version: VERSION }];
  if (path === 'reset' && method === 'POST') { db = seed(); return [200, { ok: true, message: 'Datos del laboratorio restaurados' }]; }

  // [V9] Endpoint de depuración olvidado en producción.
  if (path === 'debug' && method === 'GET') {
    return [200, { debug: true, environment: 'production', node: process.version, jwtSecret: JWT_SECRET, database: 'mongodb://admin:FAKE-Pass123@db.vulnbank.internal:27017/bank', internalServices: ['http://internal-admin.vulnbank.local', 'http://169.254.169.254'] }];
  }

  // [V10] Versión antigua de la API todavía publicada y SIN autenticación.
  if ((m = path.match(/^v1\/users\/(\d+)$/)) && method === 'GET') {
    const u = db.users.find((x) => x.id === Number(m[1]));
    return u ? [200, u] : [404, { error: 'No existe' }];
  }

  if (path === 'auth/login' && method === 'POST') {
    const { username, password } = getBody(req);
    // [V3] Sin límite de intentos (fuerza bruta) y mensajes que permiten
    // saber si un usuario existe (enumeración).
    const exists = db.users.find((u) => matches(u, { username }));
    if (!exists) return [404, { error: 'El usuario no existe' }];
    // [V11] Inyección NoSQL: {"password": {"$ne": ""}} siempre coincide.
    const user = db.users.find((u) => matches(u, { username, password }));
    if (!user) return [401, { error: 'Contraseña incorrecta para ' + exists.username }];
    const token = signJwt({ sub: user.id, username: user.username, role: user.role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 });
    return [200, { token, user }]; // [V4] devuelve el usuario completo
  }

  // A partir de aquí hace falta un token.
  const me = currentUser(req);
  if (!me) return [401, { error: 'Falta un token válido (cabecera X-Auth-Token)' }];

  if (path === 'users/me' && method === 'GET') {
    return [200, me]; // [V4] exposición excesiva: hash, DNI, PIN...
  }
  if (path === 'users/me' && method === 'PATCH') {
    // [V5] Asignación masiva: se copia cualquier campo enviado (role incluido).
    Object.assign(me, getBody(req));
    return [200, me];
  }

  if ((m = path.match(/^accounts\/([^/]+)$/)) && method === 'GET') {
    // [V1] BOLA: no se comprueba que la cuenta sea del usuario autenticado.
    const acc = db.accounts.find((a) => a.id === Number(m[1]));
    const owner = db.users.find((u) => u.id === acc.ownerId); // [V9] explota si no existe
    return [200, { ...acc, ownerName: owner.fullName, ownerEmail: owner.email }];
  }

  if ((m = path.match(/^accounts\/([^/]+)\/transactions$/)) && method === 'GET') {
    const acc = db.accounts.find((a) => a.id === Number(m[1])); // [V1]
    if (!acc) return [404, { error: 'Cuenta no encontrada' }];
    // [V12] Sin límite: el cliente decide cuántos registros genera el servidor.
    // (Tope interno de 20000 solo para proteger el propio laboratorio.)
    const limit = Math.min(parseInt(q.limit, 10) || 20, 20000);
    return [200, { accountId: acc.id, count: limit, items: transactionsFor(acc.id, limit) }];
  }

  if (path === 'transfers' && method === 'POST') {
    const { fromAccountId, toAccountId, amount } = getBody(req);
    const from = db.accounts.find((a) => a.id === Number(fromAccountId));
    const to = db.accounts.find((a) => a.id === Number(toAccountId));
    if (!from || !to) return [404, { error: 'Cuenta no encontrada' }];
    // [V7] Lógica de negocio rota: importes negativos, sin saldo suficiente,
    // y sin comprobar que la cuenta origen sea del usuario.
    const amt = Number(amount);
    from.balance = Number((from.balance - amt).toFixed(2));
    to.balance = Number((to.balance + amt).toFixed(2));
    return [200, { ok: true, from: { id: from.id, balance: from.balance }, to: { id: to.id, balance: to.balance } }];
  }

  if (path === 'admin/users' && method === 'GET') {
    // [V6] BFLA: basta con estar autenticado; no se comprueba el rol.
    return [200, db.users];
  }

  if (path === 'tools/preview' && method === 'GET') {
    // [V8] SSRF: el servidor "visita" cualquier URL que mande el cliente.
    return [200, { url: q.url, fetched: simulatedFetch(q.url) }];
  }

  return [404, { error: 'Ruta no encontrada: ' + method + ' /api/lab/' + path }];
}

// ---------------------------------------------------------------------
// Punto de entrada (Azure Functions, modelo Node v3)
// ---------------------------------------------------------------------
module.exports = async function (context, req) {
  const method = (req.method || 'GET').toUpperCase();
  const path = String((req.params && req.params.rest) || '').replace(/^\/+|\/+$/g, '');
  const origin = req.headers.origin;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    // [V9] CORS: refleja cualquier origen y permite credenciales.
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Auth-Token',
    // [V9] Cabeceras que revelan la tecnología.
    'X-Powered-By': 'VulnBank-API/0.9 Node ' + process.version,
  };

  if (method === 'OPTIONS') { context.res = { status: 204, headers, body: '' }; return; }

  try {
    const [status, body] = await route(req, path, method);
    context.res = { status, headers, body: JSON.stringify(body, null, 2) };
  } catch (err) {
    // [V9] Errores detallados: mensaje y traza completa al cliente.
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message, stack: err.stack }, null, 2) };
  }
};
module.exports.VERSION = VERSION;
