/* Threat Model Empresarial · Kora aplica el skill stride-threat-modeling en dos modos:
   DEMO (historia guionizada de VulnBank, solo lectura) e HISTORIA REAL (el usuario arma su modelo). */

const KEY = 'kora-tm-v1';
const blankReal = () => ({name:'', story:'', ctx:{}, boundaries:'', elements:[], cells:{}, threats:[], assumptions:'', finalized:false, el:null});
let APP;
function load(){
  try{ const r = JSON.parse(localStorage.getItem(KEY)); if(r && r.real) return r; }catch(e){}
  return {mode:'demo', step:{demo:0, real:0}, demoFinal:false, demoEl:'P1', real:blankReal()};
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(APP)); }catch(e){} }
APP = load();

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDemo = () => APP.mode === 'demo';
const M = () => isDemo() ? DEMO : APP.real;
const catOf = k => STRIDE.find(c => c.k === k);
const elOf = (m, id) => m.elements.find(e => e.id === id);
const elName = (m, id) => (elOf(m, id) || {name:'(elemento eliminado)'}).name;
const RANK = {Alto:0, Medio:1, Bajo:2};
const risk = t => riskOf(t.imp, t.prob);
const blocking = t => t.block ?? (risk(t) === 'Alto');
const sortT = list => [...list].sort((a,b) => RANK[risk(a)] - RANK[risk(b)] || RANK[a.imp] - RANK[b.imp] || a.id.localeCompare(b.id));

/* ---------- Kora ---------- */
let typing;
function say(html){
  const b = $('#bubble'), av = $('#avatar');
  clearInterval(typing);
  if(reduce){ b.innerHTML = '<p>' + html + '</p>'; return; }
  const parts = html.match(/<[^>]+>|[^<]/g) || [];
  let i = 0, out = '';
  av.classList.add('talking');
  typing = setInterval(() => {
    for(let n = 0; n < 3 && i < parts.length; n++){ out += parts[i++]; while(i < parts.length && parts[i][0] === '<') out += parts[i++]; }
    b.innerHTML = '<p>' + out + '<span class="caret"></span></p>';
    if(i >= parts.length){ clearInterval(typing); av.classList.remove('talking'); b.innerHTML = '<p>' + html + '</p>'; }
  }, 16);
}
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2200); }

const FAQ = [
  ['¿Qué es esta demo?', 'Una sesión de threat modeling <b>controlada</b>: en DEMO ves cómo un equipo pasa de una historia de desarrollo a specs de seguridad. En HISTORIA REAL haces lo mismo con tu proyecto.'],
  ['¿Qué hace el skill?', 'Es el guion que sigo: <b>1</b> recolectar contexto, <b>2</b> descomponer el sistema, <b>3</b> STRIDE por elemento, <b>4</b> tabla de amenazas, <b>5</b> priorizar, <b>6</b> mitigaciones accionables y cerrar con <b>supuestos</b>. Tócalo en “Ver skill”.'],
  ['¿Por qué justificar lo que no aplica?', 'El skill lo exige: <b>no se omiten categorías</b>. Una casilla vacía puede ser un olvido; una casilla justificada es una decisión que el equipo puede revisar.'],
  ['¿Cómo se calcula el riesgo?', '<b>Impacto × probabilidad</b> en una matriz 3×3. Alto×Alta, Alto×Media y Medio×Alta dan riesgo Alto; los demás bajan a Medio o Bajo.'],
  ['¿Qué es “bloqueante”?', 'Una amenaza que <b>impide salir a producción</b> hasta tener su control. Por defecto son las de riesgo Alto; el resto entra al backlog con seguimiento.'],
  ['¿Cómo usa el equipo los specs?', 'Cada spec trae requisitos con <b>DEBE</b>, criterios de aceptación <b>Dado / Cuando / Entonces</b> y cómo verificarlo. Se copian a la historia de usuario y QA los convierte en pruebas.'],
  ['¿Hay IA en vivo?', 'No. Para que la demo sea controlada y repetible, la historia DEMO y su modelo están preparados con el skill, y en HISTORIA REAL te sugiero amenazas con reglas del catálogo según lo que escribes.']
];

const STEPS = ['Historia','Contexto','Descomposición','STRIDE por elemento','Amenazas y prioridad','Specs del equipo'];
const SAY = {
  demo:[
    'Bienvenido a la demo. Esta es la <b>historia</b> que trae el equipo: VulnBank, la app de los laboratorios, va a salir a producción con tres épicas nuevas. Léela y pasa al <b>contexto</b>: es lo primero que pide el skill.',
    '<b>Skill · paso 1: recolección de contexto.</b> Antes de modelar confirmo cinco cosas: qué se construye, el flujo de datos, los activos críticos, la superficie de ataque y el despliegue. Aquí están las cinco; ninguna falta, así que puedo avanzar.',
    '<b>Skill · paso 2: descomposición.</b> Separé actores externos, procesos, almacenes y flujos, y marqué los <b>límites de confianza</b>. Ojo con el último: la salida del LLM hacia el backend también es un límite.',
    '<b>Skill · paso 3: STRIDE por elemento.</b> Recorro las seis categorías en cada elemento. Si una no aplica, lo <b>justifico</b>. Toca un elemento de la matriz para ver su análisis. El asistente Vicky tiene amenazas propias de IA: prompt injection, envenenamiento de contexto y exfiltración.',
    '<b>Skill · pasos 4, 5 y 6.</b> La tabla de amenazas ordenada por riesgo, cuáles <b>bloquean producción</b> y qué tipo de control es cada mitigación. Al final, los <b>supuestos asumidos</b>. Cuando estés listo, pulsa <b>Finalizar modelado</b>.',
    'Este es el entregable para el equipo: <b>specs de seguridad</b> con requisitos, criterios de aceptación y cómo verificarlos, trazados a cada amenaza. Puedes copiarlos en Markdown.'
  ],
  real:[
    'Tu turno. Cuéntame la <b>historia real</b> de tu proyecto como se la contarías al equipo: qué construyen, para quién, con qué tecnología, qué integra con terceros y si hay IA. Mientras más concreto, mejores sugerencias.',
    '<b>Skill · paso 1.</b> Completa el contexto. Si falta algo crítico te lo señalo: puedes seguir, pero quedará registrado como <b>supuesto</b>.',
    '<b>Skill · paso 2.</b> Lista los elementos del sistema. Puedo <b>detectar candidatos</b> en tu historia; acepta los que correspondan y agrega los que falten. Escribe un límite de confianza por línea.',
    '<b>Skill · paso 3.</b> Elige un elemento y recorre las seis categorías. Para cada una: registra una amenaza o márcala como revisada / no aplica <b>con justificación</b>. Te sugiero amenazas según tu historia.',
    '<b>Skill · pasos 4 a 6.</b> Ajusta impacto, probabilidad y tipo de control. Las de riesgo Alto quedan como bloqueantes (puedes cambiarlo). Agrega tus supuestos y pulsa <b>Finalizar modelado</b>.',
    'Listo: estos son los <b>specs de seguridad</b> generados desde tu modelo. Llévalos a tu backlog y revisa el modelo cada vez que cambie la arquitectura.'
  ]
};

/* ---------- Modo y pasos ---------- */
function setMode(mode){
  APP.mode = mode; save(); renderTop(); render();
  say(SAY[mode][APP.step[mode]]);
}
function renderTop(){
  $('#mode-demo').setAttribute('aria-pressed', isDemo());
  $('#mode-real').setAttribute('aria-pressed', !isDemo());
  $('#kora-mode').textContent = isDemo() ? 'modo demo' : 'historia real';
  const fin = isDemo() ? APP.demoFinal : APP.real.finalized;
  $('#steps').innerHTML = STEPS.map((s, i) => {
    const locked = i === 5 && !fin;
    return `<button role="tab" class="step${i === 5 ? ' practice' : ''}" aria-selected="${APP.step[APP.mode] === i}" data-step="${i}" ${locked ? 'disabled title="Disponible al finalizar el modelado"' : ''}><span class="n">${i === 5 ? (locked ? '🔒' : '★') : '0' + (i + 1)}</span>${s}</button>`;
  }).join('');
}
function go(i, quiet){
  APP.step[APP.mode] = i; save(); renderTop(); render();
  if(!quiet) say(SAY[APP.mode][i]);
  window.scrollTo({top: 0, behavior: reduce ? 'auto' : 'smooth'});
}
function render(){ [vStory, vContext, vDecomp, vAnalyze, vThreats, vSpecs][APP.step[APP.mode]](); }
const nav = (prev, next, nextLabel) => `<div class="actions nav-row">${prev !== null ? `<button class="btn ghost" data-go="${prev}">← Anterior</button>` : ''}${next !== null ? `<button class="btn" data-go="${next}">${nextLabel}</button>` : ''}</div>`;

/* ---------- 1. Historia ---------- */
function vStory(){
  if(isDemo()){
    const s = DEMO.story;
    $('#view').innerHTML = `<div class="stack">
      <div><div class="kicker">Historia del desarrollo · DEMO</div><h2>${s.title}</h2><p class="note">${s.who}</p></div>
      <article class="story">${s.paras.map(p => `<p>${p}</p>`).join('')}</article>
      <div><h3>Historias de usuario del sprint</h3>
        <ul class="epics">${s.epics.map(([id, t]) => `<li><span class="tag">${id}</span>${t}</li>`).join('')}</ul></div>
      ${nav(null, 1, 'Iniciar modelado: contexto →')}
    </div>`;
    return;
  }
  const r = APP.real;
  $('#view').innerHTML = `<div class="stack">
    <div><div class="kicker">Historia real</div><h2>Cuenta la historia de tu proyecto</h2>
    <p class="lead">Escríbela como en la planificación de un sprint: qué van a construir, para quién, con qué tecnología, dónde se despliega, qué datos maneja, con qué terceros se integra y si incluye IA.</p></div>
    <label class="f">NOMBRE DEL SISTEMA<input id="r-name" value="${esc(r.name)}" placeholder="Ej.: Portal de autogestión de clientes"></label>
    <label class="f">HISTORIA<textarea id="r-story" class="story-in" placeholder="Ej.: Vamos a lanzar un portal donde los clientes suben facturas en PDF, consultan su estado y conversan con un asistente IA. El frontend es React, la API corre en AWS Lambda con base de datos Postgres, el login usa Cognito y los pagos van por Stripe…">${esc(r.story)}</textarea></label>
    <p class="note" id="story-hint">${storyHint(r.story)}</p>
    <div class="actions nav-row"><button class="btn" data-go="1">Siguiente: contexto →</button>
      <span id="reset-zone"><button class="btn danger" id="reset">Borrar mi modelo</button></span></div>
  </div>`;
  $('#r-name').oninput = e => { r.name = e.target.value; save(); };
  $('#r-story').oninput = e => { r.story = e.target.value; save(); $('#story-hint').textContent = storyHint(r.story); };
  $('#reset').onclick = () => {
    $('#reset-zone').innerHTML = `<span class="confirm">¿Borrar historia, elementos y amenazas? <button class="btn danger" id="reset-yes">Sí, borrar</button><button class="btn ghost" id="reset-no">Cancelar</button></span>`;
    $('#reset-yes').onclick = () => { APP.real = blankReal(); APP.step.real = 0; save(); renderTop(); vStory(); say('Hoja en blanco. Empieza por <b>qué construyen y para quién</b>.'); };
    $('#reset-no').onclick = vStory;
  };
}
function storyHint(t){
  const n = (t || '').trim().split(/\s+/).filter(Boolean).length;
  if(!n) return 'Kora detectará actores, componentes y riesgos típicos a partir de lo que escribas.';
  const found = [...new Set(EL_HINTS.filter(h => h.re.test(t)).map(h => h.name))];
  return `${n} palabras · Kora detecta: ${found.length ? found.join(', ') : 'nada todavía — menciona usuarios, API, base de datos, terceros…'}`;
}

/* ---------- 2. Contexto ---------- */
function missingCtx(m){ return CTX_FIELDS.filter(([k]) => !(m.ctx[k] || '').trim()); }
function vContext(){
  const m = M();
  if(isDemo()){
    $('#view').innerHTML = `<div class="stack">
      <div><div class="kicker">Skill · 1. Recolección de contexto</div><h2>Lo que Kora confirma antes de modelar</h2></div>
      <div class="ctx-grid">${CTX_FIELDS.map(([k, t]) => `<div class="ctx"><div class="ctx-h"><span class="ok-dot">✓</span>${t}</div><p>${esc(m.ctx[k])}</p></div>`).join('')}</div>
      ${nav(0, 2, 'Siguiente: descomposición →')}
    </div>`;
    return;
  }
  const miss = missingCtx(m);
  $('#view').innerHTML = `<div class="stack">
    <div><div class="kicker">Skill · 1. Recolección de contexto</div><h2>Antes de modelar, confirmemos el contexto</h2>
    <p class="lead">Si falta algo crítico, el skill pide preguntar antes de avanzar. Puedes continuar, pero lo que quede vacío pasará a <b>Supuestos asumidos</b>.</p></div>
    ${m.story.trim() ? `<details class="story-peek"><summary>Ver mi historia</summary><p>${esc(m.story)}</p></details>` : '<div class="empty">Aún no escribiste la historia. Vuelve al paso 1 para que Kora pueda sugerirte cosas.</div>'}
    ${CTX_FIELDS.map(([k, t, h]) => `<label class="f">${t.toUpperCase()}<textarea data-ctx="${k}" placeholder="${esc(h)}">${esc(m.ctx[k])}</textarea></label>`).join('')}
    <p class="note" id="ctx-miss">${ctxMissText(miss)}</p>
    ${nav(0, 2, 'Siguiente: descomposición →')}
  </div>`;
  document.querySelectorAll('[data-ctx]').forEach(ta => ta.oninput = e => { m.ctx[ta.dataset.ctx] = e.target.value; save(); $('#ctx-miss').innerHTML = ctxMissText(missingCtx(m)); });
}
const ctxMissText = miss => miss.length ? `<span class="c-amber">Falta: ${miss.map(x => x[1].toLowerCase()).join(', ')}.</span>` : '<span class="c-baja">Contexto completo.</span>';

/* ---------- 3. Descomposición ---------- */
function bList(m){ return Array.isArray(m.boundaries) ? m.boundaries : (m.boundaries || '').split('\n').map(s => s.trim()).filter(Boolean); }
function vDecomp(){
  const m = M(), demo = isDemo();
  const groups = Object.entries(TYPES).map(([k, t]) => {
    const list = m.elements.filter(e => e.type === k);
    return `<div class="dfd-group"><div class="kicker">${t.dfd} ${t.label}s · aplica ${t.applies.split('').join(' ')}</div>
      ${list.length ? list.map(e => `<div class="comp"><span class="dfd">${e.id}</span><span class="name"><b>${esc(e.name)}</b>${e.desc ? `<br><span class="note">${esc(e.desc)}</span>` : ''}</span>${demo ? '<span></span>' : `<button class="x" data-delel="${e.id}" aria-label="Quitar ${esc(e.name)}">×</button>`}</div>`).join('') : '<p class="note">Ninguno.</p>'}</div>`;
  }).join('');
  const bl = bList(m);
  let extra = '';
  if(!demo){
    const have = new Set(m.elements.map(e => e.name.toLowerCase()));
    const sugg = EL_HINTS.filter(h => h.re.test(m.story + ' ' + Object.values(m.ctx).join(' ')) && !have.has(h.name.toLowerCase()));
    extra = `
    <div><h3>Sugerencias de Kora desde tu historia</h3>
      <div class="sugg">${sugg.length ? sugg.map((h, i) => `<button class="chip" data-addel="${EL_HINTS.indexOf(h)}">+ ${h.name} <small>${TYPES[h.type].label}</small></button>`).join('') : '<span class="note">Sin sugerencias nuevas. Agrega elementos a mano.</span>'}</div></div>
    <form id="add-el" class="row2 end">
      <label class="f">NUEVO ELEMENTO<input id="e-name" required placeholder="Ej.: Servicio de notificaciones"></label>
      <label class="f">TIPO<select id="e-type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select></label>
      <button class="btn" type="submit">Agregar</button>
    </form>
    <label class="f">LÍMITES DE CONFIANZA (UNO POR LÍNEA)<textarea id="r-b" placeholder="Internet ↔ API&#10;API ↔ base de datos&#10;Backend ↔ proveedor LLM">${esc(m.boundaries)}</textarea></label>`;
  }
  $('#view').innerHTML = `<div class="stack">
    <div><div class="kicker">Skill · 2. Descomposición del sistema</div><h2>${esc(m.name || 'Mi sistema')}</h2>
    <p class="lead">Actores externos, procesos, almacenes y flujos. La letra que aplica a cada tipo sigue STRIDE por elemento.</p></div>
    ${groups}
    ${demo ? `<div><h3>Límites de confianza</h3><ul class="bounds">${bl.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>` : extra}
    ${nav(1, 3, 'Siguiente: STRIDE por elemento →')}
  </div>`;
  if(demo) return;
  $('#add-el').onsubmit = e => { e.preventDefault(); const n = $('#e-name').value.trim(); if(!n) return; addEl(n, $('#e-type').value); };
  $('#r-b').oninput = e => { m.boundaries = e.target.value; save(); };
}
function nextElId(m, type){
  const p = {ext:'U', proc:'P', store:'D', flow:'F'}[type];
  let i = 1; while(m.elements.some(e => e.id === p + i)) i++; return p + i;
}
function addEl(name, type){
  const m = APP.real; const id = nextElId(m, type);
  m.elements.push({id, name, type, desc:''}); if(!m.el) m.el = id; save(); vDecomp();
  say(`Agregué <b>${esc(name)}</b> como ${TYPES[type].label.toLowerCase()} (${id}). En el paso 3 lo revisaremos contra <b>${TYPES[type].applies.split('').join(', ')}</b> y justificaremos el resto.`);
}

/* ---------- 4. STRIDE por elemento ---------- */
function cellOf(m, el, cat){
  const ts = m.threats.filter(t => t.el === el.id && t.cat === cat);
  if(ts.length) return {kind:'threat', ts};
  const c = (m.cells[el.id] || {})[cat];
  if(c) return {kind:c.st, note:c.note};
  if(!TYPES[el.type].applies.includes(cat)) return {kind:'na', note:NA[el.type][cat], auto:true};
  return {kind:'pending'};
}
function matrixHTML(m, sel){
  return `<div class="scroll"><table class="matrix tm-matrix"><thead><tr><th>Elemento</th>${STRIDE.map(x => `<th title="${x.es}">${x.k}</th>`).join('')}</tr></thead><tbody>
  ${m.elements.map(e => `<tr class="${e.id === sel ? 'sel' : ''}"><td><button class="linkish" data-el="${e.id}">${e.id} · ${esc(e.name)}</button></td>${STRIDE.map(x => {
    const c = cellOf(m, e, x.k);
    if(c.kind === 'threat') return `<td><span class="cell has">${c.ts.length}</span></td>`;
    if(c.kind === 'ok') return '<td><span class="cell okc" title="Revisado">✓</span></td>';
    if(c.kind === 'na') return '<td><span class="cell na" title="No aplica (justificado)">·</span></td>';
    return '<td><span class="cell zero" title="Pendiente">?</span></td>';
  }).join('')}</tr>`).join('') || '<tr><td colspan="7" class="note">Sin elementos. Agrégalos en el paso 3.</td></tr>'}
  </tbody></table></div>
  <p class="note below">Número = amenazas · ✓ = revisado sin amenaza nueva · punto = no aplica (justificado) · ? = pendiente.</p>`;
}
let openForm = null; // {cat, kind:'threat'|'note', pre}
function vAnalyze(){
  const m = M(), demo = isDemo();
  let sel = demo ? APP.demoEl : m.el;
  if(!m.elements.some(e => e.id === sel)) sel = (m.elements[0] || {}).id;
  if(!demo) m.el = sel || null;
  const el = elOf(m, sel);
  const ctxText = (m.story || '') + ' ' + Object.values(m.ctx || {}).join(' ');
  const rows = el ? STRIDE.map(x => {
    const c = cellOf(m, el, x.k);
    let body = '';
    if(c.kind === 'threat') body = c.ts.map(t => threatCard(m, t, !demo)).join('');
    else if(c.kind === 'ok') body = `<p class="cnote"><span class="st ok">Revisado</span>${esc(c.note)}${!demo ? ` <button class="x" data-delcell="${x.k}" aria-label="Quitar">×</button>` : ''}</p>`;
    else if(c.kind === 'na') body = `<p class="cnote"><span class="st na">No aplica</span>${esc(c.note)}${!demo && !c.auto ? ` <button class="x" data-delcell="${x.k}" aria-label="Quitar">×</button>` : ''}</p>`;
    else body = '<p class="cnote"><span class="st pend">Pendiente</span>Aún sin revisar. El skill pide no omitir ninguna categoría.</p>';
    let tools = '';
    if(!demo){
      const hints = T_HINTS.filter(h => h.cat === x.k && h.types.split(' ').includes(el.type) && h.re.test(ctxText + ' ' + el.name));
      tools = openForm && openForm.cat === x.k ? formHTML(x.k, openForm) : `
        <div class="actions small"><button class="btn sm" data-open="${x.k}" data-kind="threat">+ Amenaza</button>
        ${c.kind !== 'threat' ? `<button class="btn ghost sm" data-open="${x.k}" data-kind="ok">Revisado sin amenaza</button><button class="btn ghost sm" data-open="${x.k}" data-kind="na">No aplica</button>` : ''}</div>
        ${hints.length ? `<div class="sugg"><span class="note">Sugerencias:</span>${hints.map(h => `<button class="chip" data-hint="${T_HINTS.indexOf(h)}">${esc(h.desc)}</button>`).join('')}</div>` : ''}`;
    }
    return `<div class="srow"><div class="srow-h"><span class="L">${x.k}</span><div><b>${x.es}</b><div class="note">${x.q}</div></div></div><div class="srow-b">${body}${tools}</div></div>`;
  }).join('') : '';
  $('#view').innerHTML = `<div class="stack">
    <div><div class="kicker">Skill · 3. Análisis STRIDE por elemento</div><h2>Matriz elemento × STRIDE</h2></div>
    ${matrixHTML(m, sel)}
    ${el ? `<div class="el-head"><span class="tag">${TYPES[el.type].dfd} ${TYPES[el.type].label}</span><h3>${el.id} · ${esc(el.name)}</h3>${el.desc ? `<p class="note">${esc(el.desc)}</p>` : ''}</div>
    <div class="srows">${rows}</div>` : ''}
    ${nav(2, 4, 'Siguiente: amenazas y prioridad →')}
  </div>`;
  if(!demo && openForm) wireForm(el);
}
function threatCard(m, t, editable){
  const r = risk(t);
  return `<div class="threat"><span class="sev sev-${r === 'Alto' ? 'Alta' : r === 'Medio' ? 'Media' : 'Baja'}"></span>
    <div><div class="meta"><span class="tag">${t.id}</span><span class="pill ${r === 'Alto' ? 'Alta' : r === 'Medio' ? 'Media' : 'Baja'}">Riesgo ${r}</span>${blocking(t) ? '<span class="pill blk">Bloqueante</span>' : ''}</div>
    <div class="desc">${esc(t.desc)}</div>
    <div class="mit">${t.mit ? `<b>Mitigación:</b> ${esc(t.mit)}` : '<b class="c-amber">Sin mitigación todavía</b>'}</div></div>
    ${editable ? `<button class="x" data-delt="${t.id}" aria-label="Eliminar ${t.id}">×</button>` : '<span></span>'}</div>`;
}
function formHTML(cat, f){
  if(f.kind === 'threat') return `<form class="stack tform" id="tform">
    <label class="f">¿QUÉ PUEDE SALIR MAL?<textarea id="f-desc" required placeholder="Quién, cómo y qué consigue.">${esc(f.pre?.desc)}</textarea></label>
    <label class="f">MITIGACIÓN (ESPECÍFICA Y ACCIONABLE)<textarea id="f-mit" placeholder="Control concreto, no “mejorar la seguridad”.">${esc(f.pre?.mit)}</textarea></label>
    <div class="row2"><label class="f">IMPACTO<select id="f-imp">${LEVELS.map(l => `<option ${l === 'Medio' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f">PROBABILIDAD<select id="f-prob">${PROBS.map(l => `<option ${l === 'Media' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f">TIPO DE CONTROL<select id="f-ctrl">${CTRL.map(l => `<option>${l}</option>`).join('')}</select></label></div>
    <div class="actions"><button class="btn sm" type="submit">Guardar amenaza</button><button class="btn ghost sm" type="button" id="f-cancel">Cancelar</button></div></form>`;
  return `<form class="stack tform" id="tform">
    <label class="f">${f.kind === 'ok' ? '¿POR QUÉ NO HAY AMENAZA NUEVA? (CONTROL EXISTENTE O AMENAZA CUBIERTA)' : '¿POR QUÉ NO APLICA?'}<textarea id="f-note" required></textarea></label>
    <div class="actions"><button class="btn sm" type="submit">Guardar justificación</button><button class="btn ghost sm" type="button" id="f-cancel">Cancelar</button></div></form>`;
}
function wireForm(el){
  const m = APP.real, f = openForm;
  $('#f-cancel').onclick = () => { openForm = null; vAnalyze(); };
  (f.kind === 'threat' ? $('#f-desc') : $('#f-note')).focus();
  $('#tform').onsubmit = e => {
    e.preventDefault();
    if(f.kind === 'threat'){
      const desc = $('#f-desc').value.trim(); if(!desc) return;
      let n = 1; while(m.threats.some(t => t.id === 'TM-' + String(n).padStart(2, '0'))) n++;
      const t = {id:'TM-' + String(n).padStart(2, '0'), el:el.id, cat:f.cat, desc, mit:$('#f-mit').value.trim(), imp:$('#f-imp').value, prob:$('#f-prob').value, ctrl:$('#f-ctrl').value};
      m.threats.push(t); if(m.cells[el.id]) delete m.cells[el.id][f.cat];
      openForm = null; save(); vAnalyze();
      say(t.mit ? `Registré <b>${t.id}</b> con riesgo <b>${risk(t)}</b>${risk(t) === 'Alto' ? ': queda como <b>bloqueante</b> para producción' : ''}. ¿Otra forma de ${catOf(f.cat).es.toLowerCase()} aquí?` : `Registré <b>${t.id}</b> sin mitigación. El skill pide un control específico para toda amenaza Alta o Media.`);
    } else {
      const note = $('#f-note').value.trim(); if(!note) return;
      (m.cells[el.id] ||= {})[f.cat] = {st:f.kind, note};
      openForm = null; save(); vAnalyze(); toast('Justificación guardada');
    }
  };
}

/* ---------- 5. Amenazas, priorización, mitigaciones y supuestos ---------- */
function autoAssumptions(m){
  const out = missingCtx(m).map(([, t]) => `No se entregó “${t.toLowerCase()}”: el modelo asume lo descrito en la historia.`);
  const pend = []; m.elements.forEach(e => STRIDE.forEach(x => { if(cellOf(m, e, x.k).kind === 'pending') pend.push(`${e.id}·${x.k}`); }));
  if(pend.length) out.push(`Quedaron ${pend.length} casillas sin revisar (${pend.slice(0, 8).join(', ')}${pend.length > 8 ? '…' : ''}): se asume que no tienen amenazas relevantes hasta revisarlas.`);
  if(!bList(m).length) out.push('No se definieron límites de confianza explícitos.');
  return out;
}
function allAssumptions(m){
  if(m === DEMO) return DEMO.assumptions;
  return [...(m.assumptions || '').split('\n').map(s => s.trim()).filter(Boolean), ...autoAssumptions(m)];
}
function vThreats(){
  const m = M(), demo = isDemo(), T = sortT(m.threats);
  const blk = T.filter(blocking), fol = T.filter(t => !blocking(t));
  const cnt = r => T.filter(t => risk(t) === r).length;
  const cellSel = (t, k, opts) => demo ? esc(t[k]) : `<select class="mini" data-edit="${t.id}" data-k="${k}" aria-label="${k} de ${t.id}">${opts.map(o => `<option ${t[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  $('#view').innerHTML = `<div class="stack">
    <div><div class="kicker">Skill · 4. Tabla de amenazas</div><h2>${esc(m.name || 'Mi sistema')}</h2></div>
    <div class="stats">
      <div class="stat"><b>${T.length}</b>amenazas</div>
      <div class="stat"><b class="c-alta">${cnt('Alto')}</b>riesgo alto</div>
      <div class="stat"><b class="c-media">${cnt('Medio')}</b>medio</div>
      <div class="stat"><b class="c-baja">${cnt('Bajo')}</b>bajo</div>
      <div class="stat"><b class="c-alta">${blk.length}</b>bloqueantes</div>
    </div>
    <div class="scroll"><table class="ttable"><thead><tr><th>ID</th><th>Componente</th><th>STRIDE</th><th>Descripción de la amenaza</th><th>Impacto</th><th>Probabilidad</th><th>Riesgo</th><th>Mitigación propuesta</th>${demo ? '' : '<th></th>'}</tr></thead><tbody>
    ${T.length ? T.map(t => `<tr><td class="mono">${t.id}</td><td>${esc(elName(m, t.el))}</td><td class="mono" title="${catOf(t.cat).es}">${t.cat}</td><td>${esc(t.desc)}</td><td>${cellSel(t, 'imp', LEVELS)}</td><td>${cellSel(t, 'prob', PROBS)}</td><td><span class="pill ${risk(t) === 'Alto' ? 'Alta' : risk(t) === 'Medio' ? 'Media' : 'Baja'}">${risk(t)}</span></td><td>${t.mit ? esc(t.mit) : '<span class="c-amber">Pendiente</span>'}</td>${demo ? '' : `<td><button class="x" data-delt="${t.id}" aria-label="Eliminar ${t.id}">×</button></td>`}</tr>`).join('') : `<tr><td colspan="9" class="note">Aún no hay amenazas. Ve al paso 4.</td></tr>`}
    </tbody></table></div>

    <div><div class="kicker">Skill · 5. Priorización</div><h3>¿Qué bloquea la salida a producción?</h3>
    <div class="prio">
      <div class="prio-col blk"><h4>Bloqueantes para producción (${blk.length})</h4>${blk.map(t => prioItem(t, demo)).join('') || '<p class="note">Ninguna.</p>'}</div>
      <div class="prio-col fol"><h4>Aceptables con seguimiento (${fol.length})</h4>${fol.map(t => prioItem(t, demo)).join('') || '<p class="note">Ninguna.</p>'}</div>
    </div></div>

    <div><div class="kicker">Skill · 6. Recomendaciones de mitigación</div><h3>Controles para riesgos Alto y Medio</h3>
    <div class="recs">${T.filter(t => risk(t) !== 'Bajo').map(t => `<div class="rec"><div class="meta"><span class="tag">${t.id}</span>${demo ? `<span class="pill ex">${esc(t.ctrl)}</span>` : `<select class="mini" data-edit="${t.id}" data-k="ctrl" aria-label="Tipo de control de ${t.id}">${[...new Set([...CTRL, t.ctrl || 'Preventivo'])].map(o => `<option ${t.ctrl === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`}</div><p>${t.mit ? esc(t.mit) : '<span class="c-amber">Falta definir el control.</span>'}</p></div>`).join('') || '<p class="note">Sin riesgos Alto o Medio.</p>'}</div></div>

    <div><div class="kicker">Cierre del skill</div><h3>Supuestos asumidos</h3>
    ${demo ? `<ul class="bounds">${DEMO.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : `
      <label class="f">TUS SUPUESTOS (UNO POR LÍNEA)<textarea id="r-as" placeholder="Ej.: Se asume que el proveedor de pagos cumple PCI DSS.">${esc(m.assumptions)}</textarea></label>
      ${autoAssumptions(m).length ? `<p class="note">Kora agregará automáticamente:</p><ul class="bounds">${autoAssumptions(m).map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`}
    </div>
    <div class="actions nav-row"><button class="btn ghost" data-go="3">← Anterior</button><button class="btn finish" id="finish">Finalizar modelado de amenazas</button></div>
  </div>`;
  $('#finish').onclick = finish;
  if(!demo){
    const as = $('#r-as'); if(as) as.oninput = e => { m.assumptions = e.target.value; save(); };
    document.querySelectorAll('[data-edit]').forEach(s => s.onchange = () => { const t = m.threats.find(x => x.id === s.dataset.edit); t[s.dataset.k] = s.value; save(); vThreats(); });
    document.querySelectorAll('[data-block]').forEach(c => c.onchange = () => { const t = m.threats.find(x => x.id === c.dataset.block); t.block = c.checked; save(); vThreats(); });
  }
}
function prioItem(t, demo){
  return `<div class="pitem"><span class="tag">${t.id}</span><span class="pdesc">${esc(t.desc.length > 110 ? t.desc.slice(0, 107) + '…' : t.desc)}</span>${demo ? '' : `<label class="blk-tg"><input type="checkbox" data-block="${t.id}" ${blocking(t) ? 'checked' : ''}> bloqueante</label>`}</div>`;
}
function finish(){
  if(isDemo()){ APP.demoFinal = true; save(); go(5); return; }
  const m = APP.real;
  if(!m.threats.length){ say('Todavía no hay amenazas registradas. Sin amenazas no hay specs: vuelve al paso 4 y recorre al menos los procesos principales.'); return; }
  m.finalized = true; save(); go(5);
}

/* ---------- 6. Specs ---------- */
function buildSpecs(m){
  if(m === DEMO) return DEMO.specs;
  const specs = [];
  STRIDE.forEach(x => {
    const ts = sortT(m.threats.filter(t => t.cat === x.k)); if(!ts.length) return;
    const tpl = SPEC_TPL[x.k], els = [...new Set(ts.map(t => t.el))];
    specs.push({
      id:'SPEC-SEC-' + String(specs.length + 1).padStart(2, '0'), title:tpl.title, covers:ts.map(t => t.id), hu:[],
      req:ts.map(t => t.mit ? `${elName(m, t.el)} DEBE implementar: ${t.mit.replace(/\.$/, '')} (mitiga ${t.id}).` : `DEFINIR control para ${t.id} en ${elName(m, t.el)} antes de iniciar el desarrollo.`),
      ac:[...els.map(id => tpl.ac.replace('{el}', elName(m, id))), ...ts.map(t => `Dado el escenario de abuso de ${t.id} («${t.desc.replace(/\.$/, '')}»), cuando QA lo ejecuta, entonces el ataque no tiene éxito y queda registrado.`)],
      test:tpl.test
    });
  });
  return specs;
}
function specPriority(m, s){
  const ts = s.covers.map(id => m.threats.find(t => t.id === id)).filter(Boolean);
  if(ts.some(blocking)) return ['blk', 'Bloqueante para producción'];
  if(ts.some(t => risk(t) === 'Medio')) return ['med', 'Próximo sprint'];
  return ['low', 'Backlog con seguimiento'];
}
function specsMarkdown(m, specs){
  const L = [`# Specs de seguridad: ${m.name || 'Mi sistema'}`, '', `> Generado por Kora con el skill stride-threat-modeling (STRIDE). ${m.threats.length} amenazas modeladas.`, ''];
  specs.forEach(s => {
    const [, p] = specPriority(m, s);
    L.push(`## ${s.id} · ${s.title}`, '', `**Prioridad:** ${p}  `, `**Amenazas cubiertas:** ${s.covers.join(', ')}${s.hu && s.hu.length ? '  \n**Historias:** ' + s.hu.join(', ') : ''}`, '', '### Requisitos', ...s.req.map(r => `- ${r}`), '', '### Criterios de aceptación', ...s.ac.map(a => `- [ ] ${a}`), '', `**Verificación:** ${s.test}`, '');
  });
  L.push('## Trazabilidad de amenazas', '', '| ID | Componente | STRIDE | Riesgo | Bloqueante | Mitigación |', '|---|---|---|---|---|---|',
    ...sortT(m.threats).map(t => `| ${t.id} | ${elName(m, t.el)} | ${t.cat} | ${risk(t)} | ${blocking(t) ? 'Sí' : 'No'} | ${(t.mit || 'Pendiente').replace(/\|/g, '/')} |`), '', '## Supuestos asumidos', ...allAssumptions(m).map(a => `- ${a}`));
  return L.join('\n');
}
function vSpecs(){
  const m = M(), specs = buildSpecs(m);
  const nb = specs.filter(s => specPriority(m, s)[0] === 'blk').length;
  $('#view').innerHTML = `<div class="stack">
    <div><div class="kicker">Resultado del modelado · para el equipo de desarrollo</div><h2>Specs de seguridad</h2>
    <p class="lead">Cada spec agrupa amenazas relacionadas y trae lo que el equipo necesita para escribir y aceptar la historia: requisitos verificables, criterios de aceptación y cómo probarlo.</p></div>
    <div class="stats"><div class="stat"><b>${specs.length}</b>specs</div><div class="stat"><b class="c-alta">${nb}</b>bloqueantes</div><div class="stat"><b>${m.threats.length}</b>amenazas trazadas</div></div>
    <div class="actions"><button class="btn" id="copy-md">Copiar como Markdown</button><button class="btn ghost" id="dl-md">Descargar .md</button></div>
    <textarea id="md-out" class="md-out" hidden readonly></textarea>
    <div class="specs">${specs.map(s => { const [pk, p] = specPriority(m, s); return `
      <article class="spec">
        <header class="spec-h"><span class="tag">${s.id}</span><h3>${esc(s.title)}</h3><span class="prio-b ${pk}">${p}</span></header>
        <p class="note">Cubre: ${s.covers.map(id => `<span class="mono">${id}</span>`).join(', ')}${s.hu && s.hu.length ? ` · Historias: ${s.hu.join(', ')}` : ''}</p>
        <div class="spec-b"><div><div class="kicker">Requisitos</div><ul>${s.req.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
        <div><div class="kicker">Criterios de aceptación</div><ul class="ac">${s.ac.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div></div>
        <p class="verif"><b>Verificación:</b> ${esc(s.test)}</p>
      </article>`; }).join('')}</div>
    <div><h3>Supuestos que el equipo debe validar</h3><ul class="bounds">${allAssumptions(m).map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
    <div class="actions nav-row"><button class="btn ghost" data-go="4">← Volver a la tabla</button>${isDemo() ? '<button class="btn" id="to-real">Ahora con mi historia real →</button>' : ''}</div>
  </div>`;
  const md = () => specsMarkdown(m, specs);
  $('#copy-md').onclick = () => {
    const txt = md(), ta = $('#md-out'); ta.value = txt;
    const fb = () => { ta.hidden = false; ta.select(); toast('Selecciona y copia el texto'); };
    navigator.clipboard ? navigator.clipboard.writeText(txt).then(() => toast('Markdown copiado'), fb) : fb();
  };
  $('#dl-md').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md()], {type:'text/markdown'}));
    a.download = 'specs-seguridad-' + ((m.name || 'sistema').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sistema') + '.md';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const tr = $('#to-real'); if(tr) tr.onclick = () => setMode('real');
}

/* ---------- Ver skill ---------- */
function mdToHtml(md){
  let fm = '';
  md = md.replace(/^---\n([\s\S]*?)\n---\n/, (_, b) => { fm = b; return ''; });
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const lines = md.split('\n'), out = [];
  let list = null;
  const close = () => { if(list){ out.push(`</${list}>`); list = null; } };
  for(let i = 0; i < lines.length; i++){
    const l = lines[i];
    if(/^\|/.test(l)){
      close(); const rows = [];
      while(i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]); i--;
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      out.push('<div class="scroll"><table><thead><tr>' + cells(rows[0]).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.slice(2).map(r => '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
    } else if(/^#{1,4} /.test(l)){ close(); const n = l.match(/^#+/)[0].length; out.push(`<h${n + 1}>${inline(l.slice(n + 1))}</h${n + 1}>`); }
    else if(/^\s*- /.test(l)){ if(list !== 'ul'){ close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(l.replace(/^\s*- /, ''))}</li>`); }
    else if(/^\d+\. /.test(l)){ if(list !== 'ol'){ close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(l.replace(/^\d+\. /, ''))}</li>`); }
    else if(!l.trim()) close();
    else { close(); out.push(`<p>${inline(l)}</p>`); }
  }
  close();
  const meta = fm ? `<div class="fm">${fm.split('\n').map(x => { const k = x.indexOf(':'); return `<div><span class="mono">${esc(x.slice(0, k))}</span> ${esc(x.slice(k + 1).trim().replace(/^"|"$/g, ''))}</div>`; }).join('')}</div>` : '';
  return meta + out.join('');
}
let skillLoaded = false;
$('#open-skill').onclick = async () => {
  const d = $('#skill-dlg'); d.showModal();
  if(skillLoaded) return;
  try{
    const r = await fetch('/ciberseguridad/threat-model/SKILL.md', {cache:'no-cache'});
    if(!r.ok) throw new Error(r.status);
    $('#skill-body').innerHTML = mdToHtml(await r.text()); skillLoaded = true;
  }catch(e){ $('#skill-body').innerHTML = '<p class="c-amber">No se pudo cargar el skill. Usa el botón de descarga.</p>'; }
  say('Este es mi <b>skill</b>: el guion que sigo en cada sesión. Fíjate en las reglas de estilo: ser específico, justificar lo que no aplica, incluir amenazas de IA y cerrar con supuestos.');
};
$('#close-skill').onclick = () => $('#skill-dlg').close();
$('#skill-dlg').addEventListener('click', e => { if(e.target === e.currentTarget) e.currentTarget.close(); });

/* ---------- Eventos ---------- */
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('#steps').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if(b && !b.disabled) go(+b.dataset.step); });
$('#faq').innerHTML = FAQ.map((f, i) => `<button class="chip" data-faq="${i}">${f[0]}</button>`).join('');
$('#faq').addEventListener('click', e => { const b = e.target.closest('[data-faq]'); if(b) say(FAQ[b.dataset.faq][1]); });

$('#view').addEventListener('click', e => {
  const t = e.target.closest('button'); if(!t) return;
  const m = M();
  if(t.dataset.go) go(+t.dataset.go);
  else if(t.dataset.el){
    openForm = null;
    if(isDemo()) APP.demoEl = t.dataset.el; else m.el = t.dataset.el;
    save(); vAnalyze();
    const el = elOf(m, t.dataset.el), n = m.threats.filter(x => x.el === el.id).length;
    say(`<b>${esc(el.name)}</b> (${TYPES[el.type].label.toLowerCase()}): ${n} amenaza${n === 1 ? '' : 's'}. Por tipo aplican <b>${TYPES[el.type].applies.split('').join(', ')}</b>; las demás categorías quedan justificadas.`);
  }
  else if(t.dataset.addel){ const h = EL_HINTS[+t.dataset.addel]; addEl(h.name, h.type); }
  else if(t.dataset.delel){
    const id = t.dataset.delel; m.elements = m.elements.filter(x => x.id !== id); m.threats = m.threats.filter(x => x.el !== id); delete m.cells[id];
    if(m.el === id) m.el = null; save(); vDecomp();
  }
  else if(t.dataset.open){ openForm = {cat:t.dataset.open, kind:t.dataset.kind}; vAnalyze(); }
  else if(t.dataset.hint){
    const h = T_HINTS[+t.dataset.hint]; openForm = {cat:h.cat, kind:'threat', pre:{desc:h.desc, mit:h.mit}}; vAnalyze();
    say('Te dejé la sugerencia en el formulario. <b>Adáptala a tu sistema</b>: el skill pide ser específico, no genérico.');
  }
  else if(t.dataset.delcell){ const el = m.el; if(m.cells[el]) delete m.cells[el][t.dataset.delcell]; save(); vAnalyze(); }
  else if(t.dataset.delt){ m.threats = m.threats.filter(x => x.id !== t.dataset.delt); save(); render(); toast('Amenaza eliminada'); }
});

renderTop(); render(); say(SAY[APP.mode][APP.step[APP.mode]]);
