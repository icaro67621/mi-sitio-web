/*
 * VulnBank API · versión ENDURECIDA (laboratorio de seguridad en APIs)
 * ---------------------------------------------------------------------
 * Misma API que la versión vulnerable, con los 12 fallos corregidos.
 * Cada corrección está marcada con  // [V#] FIX  (mismo número que el
 * manual). Los datos siguen siendo ficticios y viven solo en memoria.
 */
const crypto = require('crypto');

const VERSION = 'endurecida';

// [V2][V9] FIX: el secreto viene de la configuración del servidor (variable de
// entorno API_LAB_JWT_SECRET). Si no existe, se genera uno aleatorio y fuerte
// al arrancar. Nunca se expone.
const JWT_SECRET = process.env.API_LAB_JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL = 15 * 60; // 15 minutos

// [V4] FIX: contraseñas con scrypt + sal aleatoria; el texto plano no se guarda.
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return { salt, hash: crypto.scryptSync(pw, salt, 32) };
}
function checkPassword(pw, rec) {
  return crypto.timingSafeEqual(crypto.scryptSync(pw, rec.salt, 32), rec.hash);
}
const SEED_USERS = [
  { id: 1001, username: 'laura', password: 'Laura2026!', fullName: 'Laura Gómez', email: 'laura@vulnbank.example', phone: '+34 600 111 222', dni: '00000001R', pin: '4821', role: 'customer', accountId: 5001 },
  { id: 1002, username: 'carlos', password: '123456', fullName: 'Carlos Ruiz', email: 'carlos@vulnbank.example', phone: '+34 600 333 444', dni: '00000002W', pin: '1234', role: 'customer', accountId: 5002 },
  { id: 1003, username: 'admin', password: 'Adm1n!VulnB4nk#2026', fullName: 'Administración VulnBank', email: 'admin@vulnbank.example', phone: '+34 600 999 000', dni: '00000003A', pin: '0000', role: 'admin', accountId: 5003 },
].map(({ password, ...u }) => ({ ...u, credential: hashPassword(password) }));
const DUMMY_CREDENTIAL = hashPassword(crypto.randomBytes(16).toString('hex'));

function seed() {
  return {
    users: SEED_USERS.map((u) => ({ ...u })),
    accounts: [
      { id: 5001, ownerId: 1001, iban: 'ES00 0000 0000 0000 0000 5001', balance: 2450.75, currency: 'EUR' },
      { id: 5002, ownerId: 1002, iban: 'ES00 0000 0000 0000 0000 5002', balance: 18320.40, currency: 'EUR' },
      { id: 5003, ownerId: 1003, iban: 'ES00 0000 0000 0000 0000 5003', balance: 999999.99, currency: 'EUR' },
    ],
  };
}
let db = seed();

// [V4] FIX: solo se devuelven los campos que el cliente necesita (DTO).
const publicUser = (u) => ({ id: u.id, username: u.username, fullName: u.fullName, email: u.email, phone: u.phone, role: u.role, accountId: u.accountId });

// ---------------------------------------------------------------------
// JWT (HS256 estricto)
// ---------------------------------------------------------------------
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const hmac = (data) => crypto.createHmac('sha256', JWT_SECRET).update(data).digest();

function signJwt(sub) {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ sub, iat: now, exp: now + TOKEN_TTL })).toString('base64url');
  return HEADER + '.' + body + '.' + hmac(HEADER + '.' + body).toString('base64url');
}

function verifyJwt(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  // [V2] FIX: solo se acepta exactamente la cabecera HS256 que emite el servidor
  // ("alg": "none" u otros algoritmos se rechazan).
  if (parts[0] !== HEADER) return null;
  const given = Buffer.from(parts[2], 'base64url');
  const expected = hmac(parts[0] + '.' + parts[1]);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return null; }
  // [V2] FIX: se comprueba la caducidad.
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
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
  // El rol se lee SIEMPRE del servidor, nunca del token.
  return db.users.find((u) => u.id === payload.sub) || null;
}

// ---------------------------------------------------------------------
// [V3] FIX: límite de intentos de login (por IP y por usuario).
// ---------------------------------------------------------------------
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map();
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.headers['x-client-ip'] || 'local').split(',')[0].trim();

function isLocked(key) {
  const f = fails.get(key);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW_MS) { fails.delete(key); return false; }
  return f.count >= MAX_FAILS;
}
function registerFail(key) {
  const f = fails.get(key);
  if (!f || Date.now() - f.first > WINDOW_MS) fails.set(key, { count: 1, first: Date.now() });
  else f.count++;
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function getBody(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (!req.rawBody) return {};
  try {
    const b = JSON.parse(req.rawBody);
    if (b && typeof b === 'object' && !Array.isArray(b)) return b;
  } catch { /* cae al error de abajo */ }
  throw new HttpError(400, 'El cuerpo debe ser un objeto JSON válido');
}

const parseId = (s) => (/^\d{1,9}$/.test(s) ? Number(s) : null);

function transactionsFor(accountId, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: accountId * 100000 + i, date: new Date(Date.UTC(2026, 0, 1) + i * 3600e3).toISOString(), concept: ['Supermercado', 'Nómina', 'Gasolinera', 'Restaurante', 'Bizum'][i % 5], amount: Number((((i * 37) % 500) - 120.5).toFixed(2)) });
  }
  return out;
}

// [V8] FIX: lista blanca de destinos, solo HTTPS y sin IPs/hosts internos.
// (Sigue siendo simulado: el laboratorio no hace peticiones salientes.)
const PREVIEW_ALLOWED_HOSTS = ['cdn.vulnbank.example', 'www.vulnbank.example'];

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
  if (path === 'reset' && method === 'POST') { db = seed(); fails.clear(); return [200, { ok: true, message: 'Datos del laboratorio restaurados' }]; }

  // [V9] FIX: el endpoint /debug ya no existe (cae en el 404 genérico).

  // [V10] FIX: la versión antigua está retirada.
  if (path === 'v1' || path.startsWith('v1/')) return [410, { error: 'La API v1 está retirada. Usa /api/lab/' }];

  if (path === 'auth/login' && method === 'POST') {
    const { username, password } = getBody(req);
    // [V11] FIX: se valida el TIPO de la entrada; solo se aceptan cadenas.
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || password.length > 128) {
      throw new HttpError(400, 'username y password deben ser texto');
    }
    const keys = ['ip:' + clientIp(req), 'user:' + username.toLowerCase()];
    if (keys.some(isLocked)) {
      return [429, { error: 'Demasiados intentos. Espera 15 minutos.' }, { 'Retry-After': '900' }];
    }
    const user = db.users.find((u) => u.username === username);
    // [V3] FIX: siempre se calcula el hash (mismo tiempo) y el mensaje es único.
    const ok = checkPassword(password, user ? user.credential : DUMMY_CREDENTIAL) && !!user;
    if (!ok) {
      keys.forEach(registerFail);
      return [401, { error: 'Credenciales inválidas' }];
    }
    keys.forEach((k) => fails.delete(k));
    return [200, { token: signJwt(user.id), expiresIn: TOKEN_TTL, user: publicUser(user) }];
  }

  const me = currentUser(req);
  if (!me) return [401, { error: 'Falta un token válido (cabecera X-Auth-Token)' }];

  if (path === 'users/me' && method === 'GET') return [200, publicUser(me)];

  if (path === 'users/me' && method === 'PATCH') {
    // [V5] FIX: lista blanca de campos editables y validación de formato.
    const body = getBody(req);
    const ALLOWED = ['email', 'phone'];
    const rejected = Object.keys(body).filter((k) => !ALLOWED.includes(k));
    if (rejected.length) throw new HttpError(400, 'Campos no permitidos: ' + rejected.join(', '));
    if ('email' in body && (typeof body.email !== 'string' || !/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(body.email))) throw new HttpError(400, 'email no válido');
    if ('phone' in body && (typeof body.phone !== 'string' || !/^\+?[0-9 ]{6,20}$/.test(body.phone))) throw new HttpError(400, 'phone no válido');
    ALLOWED.forEach((k) => { if (k in body) me[k] = body[k]; });
    return [200, publicUser(me)];
  }

  // [V1] FIX: cada cuenta se busca SOLO entre las del usuario autenticado.
  // Si no es suya, se responde 404 (no se revela que existe).
  const ownAccount = (raw) => {
    const id = parseId(raw);
    return db.accounts.find((a) => a.id === id && a.ownerId === me.id) || null;
  };

  if ((m = path.match(/^accounts\/([^/]+)$/)) && method === 'GET') {
    const acc = ownAccount(m[1]);
    if (!acc) return [404, { error: 'Cuenta no encontrada' }];
    return [200, { ...acc, ownerName: me.fullName }];
  }

  if ((m = path.match(/^accounts\/([^/]+)\/transactions$/)) && method === 'GET') {
    const acc = ownAccount(m[1]);
    if (!acc) return [404, { error: 'Cuenta no encontrada' }];
    // [V12] FIX: paginación con límite máximo validado.
    const limit = q.limit === undefined ? 20 : parseId(String(q.limit));
    if (!limit || limit > 50) throw new HttpError(400, 'limit debe estar entre 1 y 50');
    return [200, { accountId: acc.id, count: limit, items: transactionsFor(acc.id, limit) }];
  }

  if (path === 'transfers' && method === 'POST') {
    const { fromAccountId, toAccountId, amount } = getBody(req);
    // [V7] FIX: reglas de negocio en el servidor.
    const from = ownAccount(String(fromAccountId));
    if (!from) return [404, { error: 'Cuenta origen no encontrada' }];
    const to = db.accounts.find((a) => a.id === parseId(String(toAccountId)));
    if (!to || to.id === from.id) return [400, { error: 'Cuenta destino no válida' }];
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
      throw new HttpError(400, 'amount debe ser un número positivo con máximo 2 decimales');
    }
    if (amount > 10000) throw new HttpError(400, 'Supera el límite por operación (10000 EUR)');
    if (amount > from.balance) throw new HttpError(400, 'Saldo insuficiente');
    from.balance = Number((from.balance - amount).toFixed(2));
    to.balance = Number((to.balance + amount).toFixed(2));
    return [200, { ok: true, from: { id: from.id, balance: from.balance }, to: { id: to.id } }];
  }

  if (path === 'admin/users' && method === 'GET') {
    // [V6] FIX: control de acceso por función: solo el rol admin.
    if (me.role !== 'admin') return [403, { error: 'Acceso denegado' }];
    return [200, db.users.map(publicUser)];
  }

  if (path === 'tools/preview' && method === 'GET') {
    let u;
    try { u = new URL(String(q.url)); } catch { throw new HttpError(400, 'url no válida'); }
    if (u.protocol !== 'https:' || !PREVIEW_ALLOWED_HOSTS.includes(u.hostname) || u.username || u.password || (u.port && u.port !== '443')) {
      throw new HttpError(400, 'Destino no permitido');
    }
    return [200, { url: u.href, fetched: { status: 200, simulated: true, body: { title: 'Vista previa de ' + u.hostname } } }];
  }

  return [404, { error: 'Ruta no encontrada' }];
}

// ---------------------------------------------------------------------
// Punto de entrada (Azure Functions, modelo Node v3)
// ---------------------------------------------------------------------
module.exports = async function (context, req) {
  const method = (req.method || 'GET').toUpperCase();
  const path = String((req.params && req.params.rest) || '').replace(/^\/+|\/+$/g, '');
  // [V9] FIX: sin cabeceras CORS (solo el propio sitio puede llamar desde el
  // navegador), sin X-Powered-By y con cabeceras defensivas.
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };

  if (method === 'OPTIONS') { context.res = { status: 204, headers, body: '' }; return; }

  try {
    const [status, body, extra] = await route(req, path, method);
    context.res = { status, headers: { ...headers, ...(extra || {}) }, body: JSON.stringify(body, null, 2) };
  } catch (err) {
    if (err instanceof HttpError) {
      context.res = { status: err.status, headers, body: JSON.stringify({ error: err.message }, null, 2) };
      return;
    }
    // [V9] FIX: error genérico al cliente; el detalle queda en el log del servidor.
    const requestId = crypto.randomUUID();
    if (context.log && context.log.error) context.log.error('[' + requestId + ']', err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: 'Error interno', requestId }, null, 2) };
  }
};
module.exports.VERSION = VERSION;
