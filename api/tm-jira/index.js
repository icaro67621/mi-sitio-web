/*
 * Kora · Threat Model Empresarial → Jira
 * ---------------------------------------
 * POST /api/tm-jira/verify  {key}                 comprueba la llave de la demo
 * POST /api/tm-jira/status  {key}                 issues de seguridad ya enviados
 * POST /api/tm-jira/send    {key, system, threats, specs[]}
 *        crea una Tarea por spec bajo la épica, la enlaza con sus historias (HU-xx)
 *        y añade a la épica la sección "Actividades de seguridad".
 * POST /api/tm-jira/reset   {key}                 deja Jira como antes del envío:
 *        borra las tareas con la etiqueta kora-tm y quita la sección de la épica.
 *
 * Configuración (Azure Static Web Apps → Configuración → Variables de entorno):
 *   JIRA_EMAIL      correo de la cuenta Atlassian dueña del token
 *   JIRA_API_TOKEN  API token (id.atlassian.com → Seguridad → API tokens)
 *   Opcionales: JIRA_BASE_URL (https://cami88.atlassian.net), JIRA_PROJECT (LSO),
 *               JIRA_EPIC (LSO-1), TM_JIRA_KEY (sustituye la llave de la demo).
 * La llave nunca viaja al navegador: aquí solo está su SHA-256.
 */
const crypto = require('crypto');

const BASE = (process.env.JIRA_BASE_URL || 'https://cami88.atlassian.net').replace(/\/+$/, '');
const PROJECT = process.env.JIRA_PROJECT || 'LSO';
const EPIC = process.env.JIRA_EPIC || 'LSO-1';
const LABEL = 'kora-tm';
const MARK = 'Actividades de seguridad del threat model (Kora)';
const KEY_SHA256 = '86296c2b3e0e2a6889ab4f9e9e12aea8fa7a85ab817c1d36a3ec2c36a48dd9e5';
const PRIORITY = { blk: ['High', 'Bloqueante para producción'], med: ['Medium', 'Próximo sprint'], low: ['Low', 'Backlog con seguimiento'] };

class HttpError extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra; } }

/* ---------- llave + freno a fuerza bruta ---------- */
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const fails = new Map();
function checkKey(key, ip) {
  const now = Date.now(), f = fails.get(ip);
  if (f && f.until > now) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.');
  const want = process.env.TM_JIRA_KEY ? sha(process.env.TM_JIRA_KEY) : Buffer.from(KEY_SHA256, 'hex');
  if (typeof key === 'string' && key.length <= 200 && crypto.timingSafeEqual(sha(key), want)) { fails.delete(ip); return; }
  const n = (f && !f.until ? f.n : 0) + 1; // un bloqueo ya vencido vuelve a contar desde cero
  if (fails.size > 5000) fails.clear();
  fails.set(ip, { n, until: n >= 5 ? now + 10 * 60 * 1000 : 0 });
  throw new HttpError(401, 'Llave incorrecta.');
}

/* ---------- cliente Jira ---------- */
async function jira(method, path, body) {
  const { JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) throw new HttpError(503, 'Falta configurar JIRA_EMAIL y JIRA_API_TOKEN en Azure.');
  const r = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64'),
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = { raw: txt.slice(0, 300) }; }
  if (!r.ok) {
    const detail = data && (data.errorMessages || []).concat(Object.values(data.errors || {})).join(' · ');
    const err = new HttpError(r.status === 401 || r.status === 403 ? 502 : r.status >= 500 ? 502 : 400,
      `Jira respondió ${r.status}${detail ? ': ' + detail : ''}`);
    err.jiraStatus = r.status; err.data = data;
    throw err;
  }
  return data;
}
const search = (jql, fields) => jira('POST', '/rest/api/3/search/jql', { jql, fields, maxResults: 100 }).then(d => d.issues || []);
const browse = key => `${BASE}/browse/${key}`;

async function sentIssues() {
  const list = await search(`project = "${PROJECT}" AND labels = "${LABEL}" ORDER BY key ASC`, ['summary']);
  return list.map(i => ({ key: i.key, summary: i.fields.summary, url: browse(i.key) }));
}

async function taskTypeId() {
  const d = await jira('GET', `/rest/api/3/issue/createmeta/${PROJECT}/issuetypes`);
  const types = d.issueTypes || d.values || [];
  const t = types.find(x => /^(tarea|task)$/i.test(x.name)) ||
            types.find(x => !x.subtask && x.hierarchyLevel === 0 && !/historia|story|epic|épica/i.test(x.name)) ||
            types.find(x => !x.subtask && x.hierarchyLevel === 0);
  if (!t) throw new HttpError(500, `El proyecto ${PROJECT} no tiene un tipo de issue para tareas.`);
  return t.id;
}

async function storyKeys(hus) {
  if (!hus.length) return {};
  const list = await search(`project = "${PROJECT}" AND labels in (${hus.map(h => `"${h}"`).join(',')})`, ['labels']);
  const map = {};
  list.forEach(i => (i.fields.labels || []).forEach(l => { if (hus.includes(l) && !map[l]) map[l] = i.key; }));
  return map;
}

/* ---------- ADF (formato de texto de Jira) ---------- */
const T = (text, marks) => ({ type: 'text', text: String(text), ...(marks ? { marks } : {}) });
const B = text => T(text, [{ type: 'strong' }]);
const P = (...c) => ({ type: 'paragraph', content: c.filter(x => x && x.text !== '') });
const H = (level, text) => ({ type: 'heading', attrs: { level }, content: [T(text)] });
const UL = items => ({ type: 'bulletList', content: items.map(c => ({ type: 'listItem', content: [P(...(Array.isArray(c) ? c : [T(c)]))] })) });
const DOC = content => ({ type: 'doc', version: 1, content });

function taskDoc(s, hu, ctx) {
  return DOC([
    P(B('Prioridad: '), T(PRIORITY[s.prio][1])),
    P(B('Amenazas cubiertas: '), T(s.covers.join(', ') || '—')),
    P(B('Historias: '), T(hu.length ? hu.map(h => h.key ? `${h.hu} (${h.key})` : h.hu).join(', ') : '—')),
    H(3, 'Requisitos'), UL(s.req),
    H(3, 'Criterios de aceptación'), UL(s.ac),
    H(3, 'Verificación'), P(T(s.test || '—')),
    P(T(`Generado por Kora (skill stride-threat-modeling) desde el modelo de amenazas de ${ctx.system}.`, [{ type: 'em' }])),
  ]);
}

function stripSection(content) {
  const i = content.findIndex(n => n.type === 'heading' && (n.content || []).some(c => (c.text || '').includes(MARK)));
  if (i < 0) return null;
  return content.slice(0, i > 0 && content[i - 1].type === 'rule' ? i - 1 : i);
}

async function epicContent() {
  const d = await jira('GET', `/rest/api/3/issue/${EPIC}?fields=description`);
  const desc = d.fields && d.fields.description;
  return desc && Array.isArray(desc.content) ? desc.content : [];
}
const setEpic = content => jira('PUT', `/rest/api/3/issue/${EPIC}`, { fields: { description: DOC(content.length ? content : [P(T(' '))]) } });

/* ---------- validación de lo que manda la página ---------- */
function str(v, max, name) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new HttpError(400, `Campo inválido: ${name}`);
  return v.trim();
}
function arr(v, max, name, fn) {
  if (!Array.isArray(v) || v.length > max) throw new HttpError(400, `Campo inválido: ${name}`);
  return v.map((x, i) => fn(x, `${name}[${i}]`));
}
const pat = re => (x, n) => { if (typeof x !== 'string' || !re.test(x)) throw new HttpError(400, `Campo inválido: ${n}`); return x; };
function validate(body) {
  const specs = arr(body.specs, 20, 'specs', (s, n) => {
    if (!s || typeof s !== 'object') throw new HttpError(400, `Campo inválido: ${n}`);
    return {
      id: pat(/^SPEC-SEC-\d{2}$/)(s.id, n + '.id'),
      title: str(s.title, 120, n + '.title'),
      prio: PRIORITY[s.prio] ? s.prio : 'low',
      covers: arr(s.covers || [], 30, n + '.covers', pat(/^TM-\d{2,3}$/)),
      hu: arr(s.hu || [], 10, n + '.hu', pat(/^HU-\d{2}$/)),
      req: arr(s.req, 20, n + '.req', (x, m) => str(x, 600, m)),
      ac: arr(s.ac, 20, n + '.ac', (x, m) => str(x, 600, m)),
      test: typeof s.test === 'string' ? s.test.slice(0, 600) : '',
    };
  });
  if (!specs.length) throw new HttpError(400, 'No hay specs para enviar.');
  return {
    specs,
    system: typeof body.system === 'string' && body.system.trim() ? body.system.trim().slice(0, 80) : 'el sistema',
    threats: Number.isInteger(body.threats) && body.threats >= 0 ? body.threats : null,
  };
}

/* ---------- acciones ---------- */
async function send(body) {
  const { specs, system, threats } = validate(body);
  const already = await sentIssues();
  if (already.length) throw new HttpError(409, 'Las actividades ya están en Jira. Restablece el laboratorio antes de volver a enviarlas.', { issues: already, epic: { key: EPIC, url: browse(EPIC) } });

  const [typeId, stories] = await Promise.all([taskTypeId(), storyKeys([...new Set(specs.flatMap(s => s.hu))])]);
  const huOf = s => s.hu.map(h => ({ hu: h, key: stories[h] }));
  const fields = (s, withPrio) => ({
    project: { key: PROJECT },
    issuetype: { id: typeId },
    parent: { key: EPIC },
    summary: `${s.id} · ${s.title}`,
    labels: [LABEL, 'seguridad', s.id, ...s.hu],
    description: taskDoc(s, huOf(s), { system }),
    ...(withPrio ? { priority: { name: PRIORITY[s.prio][0] } } : {}),
  });

  // Creación en bloque; si el esquema del proyecto no acepta la prioridad, se reintenta sin ella.
  const created = new Array(specs.length);
  let pending = specs.map((s, i) => i);
  for (const withPrio of [true, false]) {
    if (!pending.length) break;
    const r = await jira('POST', '/rest/api/3/issue/bulk', { issueUpdates: pending.map(i => ({ fields: fields(specs[i], withPrio) })) });
    const failed = new Set((r.errors || []).map(e => e.failedElementNumber));
    const ok = pending.filter((_, j) => !failed.has(j));
    ok.forEach((i, j) => { created[i] = r.issues[j]; });
    pending = pending.filter((_, j) => failed.has(j));
    if (pending.length && !withPrio) {
      const e = (r.errors || [])[0];
      throw new HttpError(502, 'Jira no aceptó algunas tareas: ' + JSON.stringify(e && e.elementErrors && e.elementErrors.errors || {}));
    }
  }

  // Enlaces "Relates" con las historias del sprint (si fallan no se pierde el envío).
  const links = [];
  specs.forEach((s, i) => huOf(s).forEach(h => { if (h.key) links.push({ from: created[i].key, to: h.key }); }));
  const linked = await Promise.allSettled(links.map(l =>
    jira('POST', '/rest/api/3/issueLink', { type: { name: 'Relates' }, inwardIssue: { key: l.to }, outwardIssue: { key: l.from } })));

  // Sección en la épica (reemplaza una anterior si existiera).
  const content = await epicContent();
  const base = stripSection(content) || content;
  const nb = specs.filter(s => s.prio === 'blk').length;
  const date = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' });
  await setEpic([...base,
    { type: 'rule' },
    H(2, '🛡️ ' + MARK),
    P(T(`Kora modeló ${system} con STRIDE el ${date}${threats != null ? ` (${threats} amenazas)` : ''} y envía ${specs.length} actividades de seguridad al equipo de desarrollo; `),
      B(`${nb} son bloqueantes para producción`), T('. Cada tarea trae requisitos, criterios de aceptación y cómo verificarla, y está enlazada a sus historias.')),
    UL(specs.map((s, i) => [T(created[i].key, [{ type: 'link', attrs: { href: browse(created[i].key) } }]), T(` · ${s.id} · ${s.title} — `), B(PRIORITY[s.prio][1])])),
  ]);

  return {
    epic: { key: EPIC, url: browse(EPIC) },
    issues: specs.map((s, i) => ({ key: created[i].key, summary: `${s.id} · ${s.title}`, url: browse(created[i].key), prio: s.prio })),
    links: { ok: linked.filter(x => x.status === 'fulfilled').length, total: links.length },
  };
}

/* Claves LSO-n citadas en la sección de seguridad de la épica (la escribe send). */
function sectionKeys(content) {
  const i = content.findIndex(n => n.type === 'heading' && (n.content || []).some(c => (c.text || '').includes(MARK)));
  if (i < 0) return [];
  const re = new RegExp(`\\b${PROJECT}-\\d+\\b`, 'g');
  return JSON.stringify(content.slice(i)).match(re) || [];
}

async function reset(body) {
  // La búsqueda JQL de Jira se indexa con retraso: si se restablece pocos segundos después de
  // enviar, no devuelve todas las tareas. Por eso se juntan tres fuentes: la sección de la épica,
  // las claves que recuerda la página y la búsqueda. Solo se borra lo que es del proyecto y lleva
  // la etiqueta kora-tm. Uno por uno y con reintentos.
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const keyRe = new RegExp(`^${PROJECT}-\\d+$`);
  const fromPage = Array.isArray(body.keys) ? body.keys.filter(k => typeof k === 'string' && keyRe.test(k)).slice(0, 50) : [];
  const content = await epicContent();
  const deleted = [], left = [];
  const del = async key => {
    let issue;
    try { issue = await jira('GET', `/rest/api/3/issue/${key}?fields=labels,project`); }
    catch (e) { if (e.jiraStatus === 404) return; throw e; }
    if (issue.fields.project.key !== PROJECT || !(issue.fields.labels || []).includes(LABEL)) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await jira('DELETE', `/rest/api/3/issue/${key}?deleteSubtasks=true`); deleted.push(key); return; }
      catch (e) { if (e.jiraStatus === 404) return; await sleep(500 * (attempt + 1)); }
    }
    left.push(key);
  };
  const keys = new Set([...sectionKeys(content), ...fromPage, ...(await sentIssues()).map(i => i.key)]);
  for (const k of keys) await del(k);
  const clean = stripSection(content);
  if (clean) await setEpic(clean);
  if (left.length) throw new HttpError(502, `No se pudieron borrar: ${left.join(', ')}. Vuelve a pulsar «Dejar el laboratorio como antes».`);
  return { deleted, epicRestored: !!clean, epic: { key: EPIC, url: browse(EPIC) } };
}

/* ---------- entrada HTTP ---------- */
module.exports = async function (context, req) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const reply = (status, body) => { context.res = { status, headers, body: JSON.stringify(body) }; };
  try {
    const action = (context.bindingData && context.bindingData.action) || '';
    const raw = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
    if (raw.length > 200000) throw new HttpError(413, 'Petición demasiado grande.');
    const body = req.body && typeof req.body === 'object' ? req.body : (() => { try { return JSON.parse(raw || '{}'); } catch (e) { throw new HttpError(400, 'JSON inválido.'); } })();
    const ip = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-client-ip'])) || 'local').split(',')[0].trim();
    checkKey(body.key, ip);
    if (action === 'verify') return reply(200, { ok: true, epic: { key: EPIC, url: browse(EPIC) } });
    if (action === 'status') return reply(200, { issues: await sentIssues(), epic: { key: EPIC, url: browse(EPIC) } });
    if (action === 'send') return reply(201, await send(body));
    if (action === 'reset') return reply(200, await reset(body));
    throw new HttpError(404, 'Acción no encontrada.');
  } catch (err) {
    if (err instanceof HttpError) return reply(err.status, { error: err.message, ...(err.extra || {}) });
    context.log && context.log.error && context.log.error(err);
    reply(500, { error: 'Error interno.' });
  }
};
