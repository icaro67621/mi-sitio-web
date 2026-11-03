const STRIDE = [
  {k:'S', es:'Suplantación', en:'Spoofing', prop:'Autenticidad',
   q:'¿Puede alguien hacerse pasar por un usuario, servicio o componente?',
   ex:['Robo de credenciales por phishing y acceso con ellas.','Un token JWT aceptado sin validar firma ni expiración.','Una API interna que confía en el header X-User-Id que manda el cliente.'],
   mit:['MFA para usuarios','Validar firma y expiración de tokens','mTLS entre servicios','Sesiones con expiración y rotación','Bloqueo tras intentos fallidos'],
   say:'<b>S de Suplantación.</b> Aquí rompemos la <b>autenticidad</b>. Pregúntate: ¿cómo sé que quien me habla es quien dice ser? Mira sobre todo las entidades externas y los procesos que reciben peticiones.'},
  {k:'T', es:'Manipulación', en:'Tampering', prop:'Integridad',
   q:'¿Puede alguien modificar datos en tránsito, en reposo o en memoria?',
   ex:['Cambiar el monto de una transferencia interceptando la petición.','Alterar registros de la base de datos mediante inyección SQL.','Reemplazar un paquete de actualización por uno malicioso.'],
   mit:['TLS en todos los flujos','Validación en el servidor','Consultas parametrizadas','Firmas digitales o HMAC','Verificar integridad de artefactos'],
   say:'<b>T de Manipulación.</b> Rompe la <b>integridad</b>. Sigue cada dato: ¿quién puede cambiarlo mientras viaja o mientras está guardado? Nunca confíes en lo que llega del cliente.'},
  {k:'R', es:'Repudio', en:'Repudiation', prop:'No repudio',
   q:'¿Puede alguien negar haber hecho algo sin que podamos demostrarlo?',
   ex:['No hay registro de quién aprobó una transferencia.','Los administradores pueden editar o borrar los logs.','Acciones registradas sin identificar al usuario ni la hora.'],
   mit:['Logs de auditoría centralizados','Logs inmutables (WORM)','Sellos de tiempo con NTP','Firmar transacciones críticas','Registrar usuario, IP y acción'],
   say:'<b>R de Repudio.</b> Protege el <b>no repudio</b>. Si mañana un cliente dice "yo no hice esa transferencia", ¿tienes evidencia confiable? Si los logs se pueden borrar, la respuesta es no.'},
  {k:'I', es:'Divulgación de información', en:'Information disclosure', prop:'Confidencialidad',
   q:'¿Puede alguien ver datos que no debería ver?',
   ex:['Mensajes de error que muestran stack traces o consultas SQL.','Un bucket de almacenamiento público con respaldos.','IDOR: cambiar /api/cuentas/123 por /124 y ver otra cuenta.'],
   mit:['Cifrado en tránsito y en reposo','Control de acceso por objeto','Errores genéricos al usuario','Minimizar y enmascarar datos','Gestión de secretos (vault)'],
   say:'<b>I de Divulgación de información.</b> Rompe la <b>confidencialidad</b>. Revisa dónde viven los datos sensibles y por dónde salen: respuestas de la API, logs, errores, respaldos.'},
  {k:'D', es:'Denegación de servicio', en:'Denial of service', prop:'Disponibilidad',
   q:'¿Puede alguien dejar el sistema sin servicio o degradarlo?',
   ex:['Login sin límite de intentos que satura el servicio.','Una búsqueda costosa que bloquea la base de datos.','Subida de archivos sin límite de tamaño que llena el disco.'],
   mit:['Rate limiting y cuotas','Timeouts y circuit breakers','Límites de tamaño de entrada','WAF / CDN anti-DDoS','Autoescalado y monitoreo'],
   say:'<b>D de Denegación de servicio.</b> Ataca la <b>disponibilidad</b>. Busca recursos finitos: CPU, memoria, conexiones, disco, cupos de un proveedor externo. ¿Qué pasa si alguien los agota?'},
  {k:'E', es:'Elevación de privilegios', en:'Elevation of privilege', prop:'Autorización',
   q:'¿Puede alguien hacer cosas para las que no tiene permiso?',
   ex:['Un usuario cambia "role":"user" por "admin" en la petición.','Un endpoint /admin que solo se oculta en el menú.','Ejecución remota de código por deserialización insegura.'],
   mit:['Autorizar cada petición en el servidor','Mínimo privilegio','RBAC / ABAC','Aislar procesos (sandbox, contenedores)','Parches y dependencias al día'],
   say:'<b>E de Elevación de privilegios.</b> Rompe la <b>autorización</b>. No basta con saber quién eres: hay que verificar qué puedes hacer, en el servidor, en cada petición.'}
];
const TYPES = {
  ext:{label:'Entidad externa', dfd:'▭', applies:'SR'},
  proc:{label:'Proceso', dfd:'◯', applies:'STRIDE'},
  store:{label:'Almacén de datos', dfd:'═', applies:'TRID'},
  flow:{label:'Flujo de datos', dfd:'→', applies:'TID'}
};
const FAQ = [
  ['¿Qué es un modelo de amenazas?','Es un ejercicio estructurado para encontrar qué puede salir mal en un sistema <b>antes</b> de que pase. Se resume en cuatro preguntas: ¿qué estamos construyendo?, ¿qué puede salir mal?, ¿qué vamos a hacer al respecto? y ¿lo hicimos bien?'],
  ['¿Qué es un límite de confianza?','Es la línea donde cambia el nivel de confianza: Internet → tu API, tu API → la base de datos, tu sistema → un proveedor. Casi todas las amenazas aparecen justo donde un flujo cruza uno de esos límites.'],
  ['¿Qué es STRIDE por elemento?','Es un atajo: no todas las categorías aplican a todo. Una <b>entidad externa</b> puede suplantar (S) o repudiar (R). Un <b>flujo</b> sufre T, I y D. Un <b>almacén</b> sufre T, I, D y a veces R (si guarda logs). Un <b>proceso</b> puede sufrir las seis.'],
  ['¿Cómo priorizo las amenazas?','Empieza simple: impacto × probabilidad, en Alta / Media / Baja. Si tu equipo necesita más detalle, puedes usar DREAD o CVSS. Lo importante es que cada amenaza Alta tenga un responsable y una mitigación.'],
  ['¿Cuándo debo hacer esto?','En el diseño, antes de escribir código, y cada vez que cambie la arquitectura: un nuevo proveedor, un nuevo flujo de datos o un cambio de autenticación. Un modelo de amenazas es un documento vivo.'],
  ['¿Y después de STRIDE qué?','Convierte cada mitigación en una tarea del backlog, define cómo vas a verificarla (pruebas, pentest, revisión de código) y vuelve a revisar el modelo cuando cambie el sistema.']
];
const STEP_SAY = [
  '¡Hola! Soy <b>Kora</b>. Te voy a ayudar a armar tu modelo de amenazas con <b>STRIDE</b>, un método creado en Microsoft que divide las amenazas en seis categorías. Cada letra rompe una propiedad de seguridad. Toca una tarjeta para conocerla o ve al paso 2 cuando estés listo.',
  'Primero responde: <b>¿qué estamos construyendo?</b> Lista los elementos de tu sistema como en un diagrama de flujo de datos: entidades externas, procesos, almacenes y flujos. Te cargué un <b>ejemplo</b> de una app de transferencias; puedes editarlo o empezar de cero.',
  null,
  'Este es tu plan. La matriz te muestra qué combinaciones elemento × categoría aplican y cuáles <b>todavía no revisaste</b> (casillas punteadas). Una casilla vacía no siempre es un error, pero sí una pregunta que conviene hacerse.',
  'Modo práctica. Te muestro un escenario y tú eliges la categoría STRIDE. Algunos casos tocan más de una; elige la <b>principal</b> y te explico por qué.',
  'Aquí analizo <b>tu proyecto real</b> con IA. Cuéntame qué estás construyendo, sus componentes y flujos, y qué datos son sensibles. Mientras más concreto seas, más útil será el modelo. Te dejé un <b>ejemplo</b> para que veas el nivel de detalle.'
];
const QUIZ = [
  ['Un atacante reutiliza un token de sesión robado para entrar a la cuenta de otra persona.','S','Usa una identidad que no es suya: es suplantación. La mitigación típica es atar la sesión al dispositivo, expirarla rápido y pedir MFA en acciones sensibles.'],
  ['Un usuario intercepta la petición y cambia el monto de la transferencia de 10 a 10.000.','T','Modifica datos en tránsito: manipulación. TLS protege del tercero en la red, pero aquí el atacante es el propio cliente, así que hay que validar en el servidor.'],
  ['Un cliente niega haber hecho un pago y el sistema no guarda quién lo autorizó ni cuándo.','R','Sin evidencia no hay forma de probar la acción: repudio. Hacen falta logs de auditoría confiables con usuario, hora y detalle.'],
  ['La API responde a un error con el número de tarjeta completo y la consulta SQL usada.','I','Se exponen datos sensibles y detalles internos: divulgación de información. Los errores al usuario deben ser genéricos y los datos sensibles, enmascarados.'],
  ['Un bot envía 50.000 intentos de login por minuto y la app deja de responder.','D','Se agota un recurso y el servicio cae: denegación de servicio. Rate limiting, CAPTCHA progresivo y WAF ayudan. Ojo: también hay un intento de fuerza bruta (S).'],
  ['Un usuario normal entra a /admin/usuarios solo escribiendo la URL y puede borrar cuentas.','E','Obtiene permisos que no le corresponden: elevación de privilegios. La autorización tiene que validarse en el servidor, no solo ocultando el botón.'],
  ['Un empleado con acceso al servidor borra las líneas del log que muestran su acceso.','R','El efecto es que nadie puede probar lo que hizo: repudio. Técnicamente también es manipulación (T) del log; por eso los logs deben enviarse a un sistema que el operador no controle.'],
  ['Un servicio interno acepta cualquier petición que traiga el header X-Internal: true.','S','Cualquiera que agregue ese header se hace pasar por un servicio interno: suplantación. Lo correcto es autenticar servicios con mTLS o tokens firmados.']
];

const EXAMPLE = () => ({
  name:'App de transferencias (ejemplo)',
  boundaries:'Internet ↔ API Gateway · API Gateway ↔ red interna · Red interna ↔ proveedor de SMS',
  components:[
    {id:'c1',name:'Cliente app móvil',type:'ext'},
    {id:'c2',name:'API Gateway',type:'proc'},
    {id:'c3',name:'Servicio de pagos',type:'proc'},
    {id:'c4',name:'Base de datos de cuentas',type:'store'},
    {id:'c5',name:'Proveedor SMS (OTP)',type:'ext'},
    {id:'c6',name:'App → API Gateway (HTTPS)',type:'flow'}
  ],
  threats:[
    {id:'t1',cat:'S',comp:'c1',sev:'Alta',ex:true,desc:'Un atacante usa credenciales filtradas para entrar a la cuenta de un cliente.',mit:'MFA con OTP; bloqueo tras 5 intentos fallidos; alerta de nuevo dispositivo.'},
    {id:'t2',cat:'T',comp:'c6',sev:'Alta',ex:true,desc:'El cliente modifica el monto o la cuenta destino en la petición de transferencia.',mit:'Validar monto y titularidad en el servidor; firmar la operación con el OTP.'},
    {id:'t3',cat:'I',comp:'c4',sev:'Media',ex:true,desc:'Respaldos de la base de datos guardados sin cifrar.',mit:'Cifrado en reposo con llaves en un KMS; acceso a respaldos solo por rol.'}
  ]
});

let S;
function load(){ try{ const r=localStorage.getItem('kora-stride-v1'); if(r) return JSON.parse(r);}catch(e){} return {step:0,cat:'S',quiz:{i:0,score:0,done:[]},...EXAMPLE()}; }
function save(){ try{ localStorage.setItem('kora-stride-v1',JSON.stringify(S)); }catch(e){} }
S = load();

const $ = s=>document.querySelector(s);
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = ()=>Math.random().toString(36).slice(2,9);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- Avatar speech ---- */
let typing;
function say(html){
  const b=$('#bubble'), av=$('#avatar');
  clearInterval(typing);
  if(reduce){ b.innerHTML='<p>'+html+'</p>'; return; }
  // escribir por "tokens" preservando etiquetas
  const parts = html.match(/<[^>]+>|[^<]/g) || [];
  let i=0, out='';
  av.classList.add('talking');
  typing = setInterval(()=>{
    for(let n=0;n<3 && i<parts.length;n++){ out+=parts[i++]; while(i<parts.length && parts[i][0]==='<') out+=parts[i++]; }
    b.innerHTML='<p>'+out+'<span class="caret"></span></p>';
    if(i>=parts.length){ clearInterval(typing); av.classList.remove('talking'); b.innerHTML='<p>'+html+'</p>'; }
  },18);
}
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,2200); }

$('#faq').innerHTML = FAQ.map((f,i)=>`<button class="chip" data-faq="${i}">${f[0]}</button>`).join('');
$('#faq').addEventListener('click',e=>{ const b=e.target.closest('[data-faq]'); if(b) say(FAQ[b.dataset.faq][1]); });

/* ---- Steps ---- */
const STEPS = [['1','Conoce STRIDE'],['2','Describe tu sistema'],['3','Analiza'],['4','Plan de mitigación'],['','Práctica'],['','Tu proyecto con IA']];
function renderSteps(){
  $('#steps').innerHTML = STEPS.map((s,i)=>`<button role="tab" class="step${i===4?' practice':''}${i===5?' ai':''}" aria-selected="${S.step===i}" data-step="${i}">${s[0]?`<span class="n">0${s[0]}</span>`:`<span class="n">${i===5?'◆':'◇'}</span>`}${s[1]}</button>`).join('');
}
$('#steps').addEventListener('click',e=>{ const b=e.target.closest('[data-step]'); if(b) go(+b.dataset.step); });
function go(i,quiet){ S.step=i; save(); renderSteps(); render(); if(!quiet) say(i===2?catSay():STEP_SAY[i]); window.scrollTo({top:0,behavior:reduce?'auto':'smooth'}); }
const catOf = k=>STRIDE.find(c=>c.k===k);
const catSay = ()=>catOf(S.cat).say;
const compName = id=>(S.components.find(c=>c.id===id)||{name:'(elemento eliminado)'}).name;

function render(){ [vIntro,vSystem,vAnalyze,vPlan,vQuiz,vAI][S.step||0](); }

/* 1. Intro */
function vIntro(){
  $('#view').innerHTML = `
  <div class="stack">
    <div><h2>Las seis amenazas de STRIDE</h2>
    <p class="lead">Cada letra es un tipo de ataque y cada uno rompe una propiedad de seguridad. Toca una tarjeta y Kora te la explica.</p></div>
    <div class="letters">${STRIDE.map(c=>`
      <button class="lcard" data-l="${c.k}">
        <div class="row"><span class="L">${c.k}</span><div><h3>${c.es}</h3><div class="en">${c.en}</div></div></div>
        <div class="prop">Rompe: ${c.prop}</div>
        <div class="q">${c.q}</div>
      </button>`).join('')}</div>
    <div><h2>Las cuatro preguntas del modelado</h2>
    <p class="lead">Este lab sigue el marco de cuatro preguntas que usan la mayoría de equipos.</p>
    <div class="four">
      <div><b>¿Qué estamos construyendo?</b><span>Paso 2: elementos y límites de confianza.</span></div>
      <div><b>¿Qué puede salir mal?</b><span>Paso 3: recorrer STRIDE por elemento.</span></div>
      <div><b>¿Qué vamos a hacer?</b><span>Paso 3: una mitigación por amenaza.</span></div>
      <div><b>¿Lo hicimos bien?</b><span>Paso 4: revisar huecos en la matriz.</span></div>
    </div></div>
    <div class="actions"><button class="btn" data-go="1">Empezar mi modelo</button><button class="btn ghost" data-go="4">Practicar primero</button></div>
  </div>`;
}

/* 2. System */
function vSystem(){
  $('#view').innerHTML = `
  <div class="stack">
    <div><h2>¿Qué estamos construyendo?</h2>
    <p class="lead">Nombra el sistema y lista sus elementos. Piensa en el diagrama de flujo de datos (DFD): quién entra, qué procesa, dónde se guarda y por dónde viaja.</p></div>
    <div class="row2">
      <label class="f">NOMBRE DEL SISTEMA<input id="sys-name" value="${esc(S.name)}"></label>
      <label class="f">LÍMITES DE CONFIANZA<input id="sys-b" value="${esc(S.boundaries)}" placeholder="Ej.: Internet ↔ API · API ↔ base de datos"></label>
    </div>
    <div class="comp-list">${S.components.length?S.components.map(c=>`
      <div class="comp"><span class="dfd" title="Símbolo DFD">${TYPES[c.type].dfd}</span><span class="name">${esc(c.name)}</span>
        <span class="comp-end"><span class="tag">${TYPES[c.type].label}</span><button class="x" data-delc="${c.id}" aria-label="Quitar ${esc(c.name)}">×</button></span></div>`).join('')
      :'<div class="empty">Todavía no hay elementos. Agrega el primero abajo, por ejemplo "Usuario web" como entidad externa.</div>'}</div>
    <form id="add-comp" class="row2 end">
      <label class="f">NUEVO ELEMENTO<input id="c-name" placeholder="Ej.: Servicio de notificaciones" required></label>
      <label class="f">TIPO<select id="c-type">${Object.entries(TYPES).map(([k,t])=>`<option value="${k}">${t.label}</option>`).join('')}</select></label>
      <button class="btn" type="submit">Agregar elemento</button>
    </form>
    <div class="legend">
      <div><b>▭ Entidad externa</b>: personas o sistemas fuera de tu control.</div>
      <div><b>◯ Proceso</b>: código que ejecuta lógica (API, servicio, función).</div>
      <div><b>═ Almacén</b>: donde se guardan datos (BD, bucket, caché, logs).</div>
      <div><b>→ Flujo</b>: datos que viajan entre elementos.</div>
    </div>
    <div class="actions">
      <button class="btn" data-go="2">Siguiente: analizar con STRIDE</button>
      <span id="reset-zone"><button class="btn danger" id="reset">Empezar de cero</button></span>
    </div>
  </div>`;
  $('#sys-name').oninput=e=>{S.name=e.target.value;save();};
  $('#sys-b').oninput=e=>{S.boundaries=e.target.value;save();};
  $('#add-comp').onsubmit=e=>{ e.preventDefault(); const n=$('#c-name').value.trim(); if(!n) return;
    const t=$('#c-type').value; S.components.push({id:uid(),name:n,type:t}); save(); vSystem();
    say(`Agregaste <b>${esc(n)}</b> (${TYPES[t].label.toLowerCase()}). Según STRIDE por elemento, revísalo contra: <b>${TYPES[t].applies.split('').join(', ')}</b>.`); $('#c-name').focus(); };
  $('#reset').onclick=()=>{ $('#reset-zone').innerHTML=`<span class="confirm">¿Borrar el ejemplo y todas las amenazas? <button class="btn danger" id="reset-yes">Sí, borrar todo</button><button class="btn ghost" id="reset-no">Cancelar</button></span>`;
    $('#reset-yes').onclick=()=>{ Object.assign(S,{name:'',boundaries:'',components:[],threats:[]}); save(); vSystem(); say('Listo, hoja en blanco. Empieza por <b>quién usa el sistema</b> (entidades externas) y luego sigue el camino de los datos.'); };
    $('#reset-no').onclick=vSystem; };
}

/* 3. Analyze */
let prefillComp=null;
function vAnalyze(){
  const c=catOf(S.cat);
  const applic = S.components.filter(x=>TYPES[x.type].applies.includes(c.k));
  const list = S.threats.filter(t=>t.cat===c.k);
  $('#view').innerHTML = `
  <div class="stack">
    <div class="cats" role="tablist">${STRIDE.map(x=>{const n=S.threats.filter(t=>t.cat===x.k).length;return `<button class="cat" role="tab" aria-selected="${x.k===S.cat}" data-cat="${x.k}"><span class="L">${x.k}</span><small>${n} amenaza${n===1?'':'s'}</small></button>`}).join('')}</div>
    <div>
      <div class="kicker">${c.en} · rompe ${c.prop.toLowerCase()}</div>
      <h2>${c.es}</h2>
      <p class="lead flush">${c.q}</p>
    </div>
    <div class="catinfo">
      <div><div class="kicker">Ejemplos típicos</div><ul>${c.ex.map(e=>`<li>${e}</li>`).join('')}</ul></div>
      <div><div class="kicker">Revisa estos elementos</div>
        <p class="note tight">Según STRIDE por elemento, ${c.k} aplica a: ${Object.values(TYPES).filter(t=>t.applies.includes(c.k)).map(t=>t.label.toLowerCase()).join(', ')}.</p>
        <div class="applies">${applic.length?applic.map(x=>`<button class="chip" data-pre="${x.id}">+ ${esc(x.name)}<small>${S.threats.filter(t=>t.cat===c.k&&t.comp===x.id).length}</small></button>`).join(''):'<span class="note">Ningún elemento de tu sistema es de este tipo. Agrega elementos en el paso 2.</span>'}</div>
      </div>
    </div>
    <form id="add-t" class="stack tform">
      <h3>Nueva amenaza de ${c.es.toLowerCase()}</h3>
      <div class="row2">
        <label class="f">ELEMENTO AFECTADO<select id="t-comp" required>${S.components.map(x=>`<option value="${x.id}" ${prefillComp===x.id?'selected':''}>${esc(x.name)}${TYPES[x.type].applies.includes(c.k)?'':' (no típico)'}</option>`).join('')}</select></label>
        <label class="f">SEVERIDAD<select id="t-sev"><option>Alta</option><option selected>Media</option><option>Baja</option></select></label>
      </div>
      <label class="f">¿QUÉ PUEDE SALIR MAL?<textarea id="t-desc" required placeholder="Describe la amenaza: quién, cómo y qué consigue."></textarea></label>
      <label class="f">¿QUÉ VAMOS A HACER? (MITIGACIÓN)<textarea id="t-mit" placeholder="Controles que reducen o eliminan la amenaza."></textarea></label>
      <div><span class="note">Sugerencias de Kora (toca para agregar):</span><div class="sugg">${c.mit.map(m=>`<button type="button" class="chip" data-mit="${esc(m)}">${m}</button>`).join('')}</div></div>
      <div class="actions"><button class="btn" type="submit" ${S.components.length?'':'disabled'}>Agregar amenaza</button></div>
    </form>
    <div class="threats">${list.length?list.map(threatHTML).join(''):`<div class="empty">Aún no hay amenazas de ${c.es.toLowerCase()}. Toca un elemento arriba para empezar.</div>`}</div>
    <div class="actions">
      ${S.cat!=='E'?`<button class="btn ghost" data-nextcat>Siguiente: ${catOf(STRIDE[STRIDE.findIndex(x=>x.k===S.cat)+1].k).es}</button>`:''}
      <button class="btn" data-go="3">Ver plan de mitigación</button>
    </div>
  </div>`;
  $('#add-t').onsubmit=e=>{ e.preventDefault(); const d=$('#t-desc').value.trim(); if(!d) return;
    S.threats.push({id:uid(),cat:S.cat,comp:$('#t-comp').value,sev:$('#t-sev').value,desc:d,mit:$('#t-mit').value.trim()}); prefillComp=null; save(); vAnalyze();
    const sev=S.threats.at(-1).sev, hasMit=!!S.threats.at(-1).mit;
    say(hasMit?`Bien. Registré la amenaza con severidad <b>${sev}</b>. ¿Hay otra forma de ${c.es.toLowerCase()} en otro elemento?`:`La registré, pero <b>no tiene mitigación</b>. Una amenaza sin plan es solo una preocupación; vuelve a ella cuando la tengas clara.`); toast('Amenaza agregada'); };
}
function threatHTML(t){
  return `<div class="threat"><span class="sev sev-${t.sev}"></span>
    <div><div class="meta"><span class="pill ${t.sev}">${t.sev}</span><span class="tag">${t.cat} · ${esc(compName(t.comp))}</span>${t.ex?'<span class="pill ex">ejemplo</span>':''}</div>
    <div class="desc">${esc(t.desc)}</div>
    <div class="mit">${t.mit?`<b>Mitigación:</b> ${esc(t.mit)}`:'<b class="c-amber">Sin mitigación todavía</b>'}</div></div>
    <button class="x" data-delt="${t.id}" aria-label="Eliminar amenaza">×</button></div>`;
}

/* 4. Plan */
function vPlan(){
  const T=S.threats, sevN=s=>T.filter(t=>t.sev===s).length, noMit=T.filter(t=>!t.mit).length;
  let gaps=0;
  const rows=S.components.map(c=>`<tr><td>${esc(c.name)}<br><span class="note">${TYPES[c.type].label}</span></td>${STRIDE.map(x=>{
      if(!TYPES[c.type].applies.includes(x.k)) return '<td><span class="cell na">·</span></td>';
      const n=T.filter(t=>t.cat===x.k&&t.comp===c.id).length; if(!n) gaps++;
      return `<td><span class="cell ${n?'has':'zero'}">${n||'?'}</span></td>`;}).join('')}</tr>`).join('');
  const order={Alta:0,Media:1,Baja:2};
  const sorted=[...T].sort((a,b)=>order[a.sev]-order[b.sev]);
  $('#view').innerHTML = `
  <div class="stack">
    <div><h2>${esc(S.name||'Mi sistema')}</h2>
    <p class="lead">${S.boundaries?'Límites de confianza: '+esc(S.boundaries):'Sin límites de confianza definidos. Agrégalos en el paso 2.'}</p></div>
    <div class="stats">
      <div class="stat"><b>${T.length}</b>amenazas</div>
      <div class="stat"><b class="c-alta">${sevN('Alta')}</b>altas</div>
      <div class="stat"><b class="c-media">${sevN('Media')}</b>medias</div>
      <div class="stat"><b class="c-baja">${sevN('Baja')}</b>bajas</div>
      <div class="stat"><b class="c-amber">${noMit}</b>sin mitigación</div>
      <div class="stat"><b>${gaps}</b>casillas sin revisar</div>
    </div>
    <div><h3>Matriz elemento × STRIDE</h3>
    <p class="note below">Número = amenazas registradas · ? = aplica pero aún no la revisaste · punto = no aplica.</p>
    <div class="scroll"><table class="matrix"><thead><tr><th>Elemento</th>${STRIDE.map(x=>`<th title="${x.es}">${x.k}</th>`).join('')}</tr></thead><tbody>${rows||'<tr><td colspan="7" class="note">Sin elementos.</td></tr>'}</tbody></table></div></div>
    <div><h3>Amenazas y mitigaciones</h3>
    <div class="scroll"><table><thead><tr><th>Sev.</th><th>Cat.</th><th>Elemento</th><th>Amenaza</th><th>Mitigación</th><th></th></tr></thead><tbody>
    ${sorted.length?sorted.map(t=>`<tr><td><span class="pill ${t.sev}">${t.sev}</span></td><td class="mono">${t.cat}</td><td>${esc(compName(t.comp))}</td><td>${esc(t.desc)}</td><td>${t.mit?esc(t.mit):'<span class="c-amber">Pendiente</span>'}</td><td><button class="x" data-delt="${t.id}" aria-label="Eliminar amenaza">×</button></td></tr>`).join(''):'<tr><td colspan="6" class="note">Aún no hay amenazas. Ve al paso 3.</td></tr>'}
    </tbody></table></div></div>
    <div class="actions"><button class="btn" id="copy-md">Copiar como Markdown</button><button class="btn ghost" data-go="2">Volver a analizar</button></div>
    <textarea id="md-out" class="md-out" hidden readonly></textarea>
  </div>`;
  $('#copy-md').onclick=()=>{
    const md=[`# Modelo de amenazas: ${S.name||'Mi sistema'}`,'',`**Límites de confianza:** ${S.boundaries||'—'}`,'','## Elementos',...S.components.map(c=>`- ${c.name} (${TYPES[c.type].label})`),'','## Amenazas','','| Severidad | STRIDE | Elemento | Amenaza | Mitigación |','|---|---|---|---|---|',
      ...sorted.map(t=>`| ${t.sev} | ${t.cat} – ${catOf(t.cat).es} | ${compName(t.comp)} | ${t.desc.replace(/\|/g,'/')} | ${(t.mit||'Pendiente').replace(/\|/g,'/')} |`)].join('\n');
    const ta=$('#md-out'); ta.value=md;
    navigator.clipboard?.writeText(md).then(()=>toast('Markdown copiado')).catch(()=>{ ta.hidden=false; ta.select(); toast('Selecciona y copia el texto'); }) ?? (ta.hidden=false, ta.select());
  };
}

/* Quiz */
function vQuiz(){
  const q=S.quiz;
  if(q.i>=QUIZ.length){
    $('#view').innerHTML=`<div class="stack"><h2>Resultado: ${q.score} de ${QUIZ.length}</h2>
      <p class="lead">${q.score===QUIZ.length?'Perfecto. Ya distingues las seis categorías.':q.score>=5?'Muy bien. Repasa las que fallaste en el paso 1.':'Vale la pena repasar las tarjetas del paso 1 y volver a intentarlo.'}</p>
      <div class="actions"><button class="btn" id="q-again">Intentar de nuevo</button><button class="btn ghost" data-go="1">Armar mi modelo</button></div></div>`;
    $('#q-again').onclick=()=>{S.quiz={i:0,score:0,done:[]};save();vQuiz();say(STEP_SAY[4]);};
    return;
  }
  const [txt]=QUIZ[q.i];
  $('#view').innerHTML=`<div class="stack">
    <div class="progress">ESCENARIO ${q.i+1} / ${QUIZ.length} · ACIERTOS ${q.score}</div>
    <p class="scenario">${txt}</p>
    <div class="answers">${STRIDE.map(x=>`<button class="ans" data-ans="${x.k}"><span class="L">${x.k}</span>${x.es}</button>`).join('')}</div>
    <div class="actions" id="q-next" hidden><button class="btn" id="q-go">Siguiente escenario</button></div>
  </div>`;
}
function answer(k){
  const q=S.quiz, [,ok,why]=QUIZ[q.i];
  document.querySelectorAll('.ans').forEach(b=>{ b.disabled=true; if(b.dataset.ans===ok) b.classList.add('ok'); else if(b.dataset.ans===k) b.classList.add('bad'); });
  if(k===ok) q.score++;
  say((k===ok?'<b>¡Correcto!</b> ':`Casi. La principal es <b>${ok} · ${catOf(ok).es}</b>. `)+why);
  $('#q-next').hidden=false;
  $('#q-go').onclick=()=>{ q.i++; save(); vQuiz(); };
  save();
}

/* Delegated events */
$('#view').addEventListener('click',e=>{
  const t=e.target.closest('button'); if(!t) return;
  if(t.dataset.go) go(+t.dataset.go);
  else if(t.dataset.l){ say(catOf(t.dataset.l).say); }
  else if(t.dataset.cat){ S.cat=t.dataset.cat; prefillComp=null; save(); vAnalyze(); say(catSay()); }
  else if(t.dataset.pre){ prefillComp=t.dataset.pre; $('#t-comp').value=prefillComp; $('#t-desc').focus();
    const c=catOf(S.cat); say(`Pensemos en <b>${esc(compName(prefillComp))}</b>: ${c.q.charAt(0).toLowerCase()+c.q.slice(1)}`); }
  else if(t.dataset.mit){ const ta=$('#t-mit'); ta.value=ta.value.trim()?ta.value.trim().replace(/[.;]?$/,'; ')+t.dataset.mit:t.dataset.mit; }
  else if(t.dataset.delc){ const id=t.dataset.delc; S.components=S.components.filter(c=>c.id!==id); S.threats=S.threats.filter(x=>x.comp!==id); save(); vSystem(); }
  else if(t.dataset.delt){ S.threats=S.threats.filter(x=>x.id!==t.dataset.delt); save(); render(); toast('Amenaza eliminada'); }
  else if(t.hasAttribute('data-nextcat')){ S.cat=STRIDE[STRIDE.findIndex(x=>x.k===S.cat)+1].k; prefillComp=null; save(); vAnalyze(); say(catSay()); }
  else if(t.dataset.ans) answer(t.dataset.ans);
});

/* ================= Tu proyecto con IA ================= */
const AI_FIELDS = [
  ['nombre','NOMBRE DEL PROYECTO','input','Ej.: App de reservas del gimnasio'],
  ['descripcion','¿QUÉ SE ESTÁ CONSTRUYENDO?','textarea','Qué hace, para quién y cuáles son sus funciones principales.'],
  ['componentes','COMPONENTES, ACTORES Y FLUJOS DE DATOS','textarea','Una línea por elemento o flujo. Ej.: Usuario → Frontend React → API Node → PostgreSQL. Indica dónde cambia el nivel de confianza.'],
  ['activos','ACTIVOS CRÍTICOS','textarea','Datos o funciones sensibles: datos personales, pagos, credenciales, lógica de negocio.'],
  ['superficie','SUPERFICIE DE ATAQUE','textarea','Entradas externas: APIs, formularios, webhooks, subida de archivos, integraciones, LLMs.'],
  ['despliegue','CONTEXTO DE DESPLIEGUE','textarea','Cloud u on-prem, cómo se autentican usuarios y servicios, si hay componentes de IA.']
];
function aiDefault(){
  return { codigo:'', ejemplo:true, proyecto:{
    nombre:'Plataforma de tutorías con asistente IA (ejemplo)',
    descripcion:'Plataforma web donde estudiantes agendan tutorías con docentes, suben sus tareas en PDF y conversan con un asistente de IA que responde dudas usando el material del curso. Los docentes califican las tareas y ven el historial de cada estudiante.',
    componentes:'Estudiante y Docente (navegador) → Frontend web (React) → API backend (Node.js en Azure App Service)\nAPI → Base de datos PostgreSQL (usuarios, tutorías, calificaciones)\nAPI → Almacenamiento de archivos (Azure Blob) para los PDF de tareas\nAPI → Asistente IA (LLM externo) con acceso de lectura al material del curso y a las tareas del estudiante\nAPI → Servicio de correo para notificaciones\nLímites de confianza: Internet ↔ API; API ↔ red interna (BD y Blob); API ↔ proveedor LLM',
    activos:'Datos personales de estudiantes, calificaciones, tareas entregadas, credenciales de acceso, material del curso.',
    superficie:'Login con correo y contraseña, API REST pública, subida de PDF, chat con el asistente IA, enlaces en correos de notificación.',
    despliegue:'Azure (App Service, PostgreSQL administrado, Blob Storage). Autenticación con JWT emitido por la propia API. El LLM es un servicio externo llamado con una API key guardada en variables de entorno.',
    respuestas:''
  }, res:null };
}
const RISK_ORDER = {Alto:0,Medio:1,Bajo:2};
let aiBusy=false;

async function aiCall(body){
  const r = await fetch('/api/stride',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigo:S.ai.codigo,proyecto:S.ai.proyecto,...body})});
  let j={}; try{ j=await r.json(); }catch(e){}
  if(!r.ok) throw new Error(j.error||`Error ${r.status} al contactar el servidor.`);
  return j.datos;
}

function vAI(){
  const A=S.ai, R=A.res;
  $('#view').innerHTML = `
  <div class="stack">
    <div><div class="kicker">Análisis asistido · STRIDE</div><h2>Modela las amenazas de tu proyecto</h2>
    <p class="lead flush">Describe tu aplicación o proyecto y Kora hará un modelo de amenazas completo: descomposición del sistema, STRIDE por elemento, priorización, mitigaciones y supuestos.</p></div>
    <p class="warn">No pegues contraseñas, claves de API ni datos reales de personas. El texto se envía a un servicio de IA externo para ser analizado.</p>
    <form id="ai-form" class="stack tform">
      ${AI_FIELDS.map(([k,l,t,ph])=>`<label class="f">${l}${t==='input'
        ?`<input id="ai-${k}" data-aif="${k}" value="${esc(A.proyecto[k])}" placeholder="${esc(ph)}">`
        :`<textarea id="ai-${k}" data-aif="${k}" placeholder="${esc(ph)}" rows="${k==='componentes'?6:3}">${esc(A.proyecto[k])}</textarea>`}</label>`).join('')}
      ${A.proyecto.respuestas||(R&&R.contexto&&!R.contexto.suficiente)?`<label class="f">RESPUESTAS A LAS PREGUNTAS DE KORA<textarea id="ai-respuestas" data-aif="respuestas" rows="4" placeholder="Responde las preguntas críticas que aparecen más abajo.">${esc(A.proyecto.respuestas)}</textarea></label>`:''}
      <div class="row2 end">
        <label class="f">CÓDIGO DE ACCESO<input id="ai-codigo" type="password" autocomplete="off" value="${esc(A.codigo)}" placeholder="Te lo da el docente"></label>
        <div class="actions"><button class="btn" type="submit" id="ai-go" ${aiBusy?'disabled':''}>${aiBusy?'Analizando…':'Analizar con Kora'}</button>
        ${A.ejemplo?'<button type="button" class="btn ghost" id="ai-clear">Borrar ejemplo</button>':''}</div>
      </div>
    </form>
    <div id="ai-progress"></div>
    <div id="ai-report"></div>
  </div>`;
  $('#ai-form').addEventListener('input',e=>{ const k=e.target.dataset.aif; if(k){ A.proyecto[k]=e.target.value; A.ejemplo=false; save(); } else if(e.target.id==='ai-codigo'){ A.codigo=e.target.value; save(); } });
  $('#ai-form').onsubmit=e=>{ e.preventDefault(); aiRun(false); };
  if(A.ejemplo) $('#ai-clear').onclick=()=>{ for(const k in A.proyecto) A.proyecto[k]=''; A.ejemplo=false; A.res=null; save(); vAI(); say('Listo. Empieza por <b>qué hace tu sistema</b> y luego lista sus piezas y cómo viajan los datos entre ellas.'); };
  if(R) renderAIReport();
}

function progressHTML(st){
  const chip=(label,s)=>`<span class="pchip ${s}">${label}<small>${{wait:'en espera',run:'analizando…',ok:'listo',err:'error'}[s]}</small></span>`;
  return `<div class="progress-box"><div class="kicker">Progreso del análisis</div><div class="pchips">
    ${chip('Contexto',st.contexto)}${STRIDE.map(c=>chip(c.k+' · '+c.es,st[c.k])).join('')}${chip('Plan',st.plan)}</div></div>`;
}

async function aiRun(skipQuestions){
  const A=S.ai;
  if(aiBusy) return;
  if(!A.codigo.trim()){ say('Necesito el <b>código de acceso</b> que te dio el docente para usar el análisis con IA.'); $('#ai-codigo').focus(); return; }
  if((A.proyecto.descripcion||'').trim().length<40){ say('Cuéntame un poco más sobre <b>qué se está construyendo</b>. Con un par de frases ya puedo empezar.'); $('#ai-descripcion').focus(); return; }
  aiBusy=true; const st={contexto:'run',plan:'wait'}; STRIDE.forEach(c=>st[c.k]='wait');
  const paint=()=>{ const p=$('#ai-progress'); if(p) p.innerHTML=progressHTML(st); const b=$('#ai-go'); if(b){b.disabled=true;b.textContent='Analizando…';} };
  const prev=A.res;
  A.res={contexto:prev&&skipQuestions?prev.contexto:null,amenazas:{},errores:{},plan:null}; $('#ai-report').innerHTML=''; paint();
  try{
    if(!(skipQuestions&&A.res.contexto)){
      say('Primero reviso si tengo el <b>contexto</b> suficiente y descompongo tu sistema en actores, procesos, almacenes y flujos…');
      A.res.contexto=await aiCall({fase:'contexto'});
    }
    st.contexto='ok'; save(); paint();
    const ctx=A.res.contexto;
    if(!ctx.suficiente && !skipQuestions){
      aiBusy=false; save(); vAI();
      say('Antes de seguir necesito algunos datos. Respóndelos en el campo <b>Respuestas</b> y vuelve a analizar, o continúa y los trataré como <b>supuestos</b>.');
      return;
    }
    say('Ahora recorro tu sistema con las <b>seis categorías de STRIDE</b> en paralelo. Esto toma alrededor de un minuto.');
    STRIDE.forEach(c=>st[c.k]='run'); paint();
    await Promise.all(STRIDE.map(c=>aiCall({fase:'amenazas',categoria:c.k,contexto:ctx})
      .then(d=>{A.res.amenazas[c.k]=d; st[c.k]='ok';})
      .catch(e=>{A.res.errores[c.k]=e.message; st[c.k]='err';})
      .finally(paint)));
    numberThreats();
    const list=allThreats();
    if(!list.length) throw new Error(Object.values(A.res.errores)[0]||'No se identificaron amenazas.');
    st.plan='run'; paint(); say('Último paso: <b>priorizo</b> las amenazas y propongo controles concretos…');
    try{ A.res.plan=await aiCall({fase:'plan',contexto:ctx,amenazas:list.map(t=>({id:t.id,categoria:t.cat,componente:t.componente,descripcion:t.descripcion,riesgo:t.riesgo,mitigacion:t.mitigacion}))}); st.plan='ok'; }
    catch(e){ A.res.errores.plan=e.message; st.plan='err'; }
    const nAlto=list.filter(t=>t.riesgo==='Alto').length, fails=Object.keys(A.res.errores).length;
    say(`Listo: encontré <b>${list.length} amenazas</b>, ${nAlto} de riesgo alto.${fails?` Hubo ${fails} parte(s) con error; puedes reintentarlas abajo.`:''} Revisa primero las <b>bloqueantes</b>.`);
  }catch(e){
    say('No pude completar el análisis: <b>'+esc(e.message)+'</b>');
    if(!A.res.contexto) A.res=prev;
  }
  aiBusy=false; save(); vAI();
}
function numberThreats(){
  let n=0; const A=S.ai;
  STRIDE.forEach(c=>{ const d=A.res.amenazas[c.k]; if(d) d.amenazas.forEach(t=>{ t.id='A'+String(++n).padStart(2,'0'); }); });
}
function allThreats(){
  const out=[]; STRIDE.forEach(c=>{ const d=S.ai.res&&S.ai.res.amenazas[c.k]; if(d) d.amenazas.forEach(t=>out.push({...t,cat:c.k})); });
  return out.sort((a,b)=>RISK_ORDER[a.riesgo]-RISK_ORDER[b.riesgo]||RISK_ORDER[a.impacto]-RISK_ORDER[b.impacto]);
}
async function aiRetry(k){
  const A=S.ai; if(aiBusy) return; aiBusy=true;
  say(k==='plan'?'Reintento la <b>priorización</b>…':`Reintento la categoría <b>${catOf(k).es}</b>…`);
  try{
    if(k==='plan'){ A.res.plan=await aiCall({fase:'plan',contexto:A.res.contexto,amenazas:allThreats().map(t=>({id:t.id,categoria:t.cat,componente:t.componente,descripcion:t.descripcion,riesgo:t.riesgo,mitigacion:t.mitigacion}))}); }
    else { A.res.amenazas[k]=await aiCall({fase:'amenazas',categoria:k,contexto:A.res.contexto}); numberThreats(); }
    delete A.res.errores[k]; say('Listo, ya está agregado al reporte.');
  }catch(e){ say('Sigue fallando: <b>'+esc(e.message)+'</b>'); }
  aiBusy=false; save(); vAI();
}

function renderAIReport(){
  const R=S.ai.res, C=R.contexto; if(!C) return;
  const list=allThreats(), P=R.plan, pri={}; (P?P.priorizacion:[]).forEach(p=>pri[p.id]=p);
  const recs=P?P.recomendaciones:[];
  const li=a=>a&&a.length?`<ul class="clean">${a.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="note">Ninguno.</p>';
  const els=(a)=>a.length?`<ul class="clean">${a.map(x=>`<li><b>${esc(x.nombre)}</b>: ${esc(x.descripcion)}</li>`).join('')}</ul>`:'<p class="note">Ninguno identificado.</p>';
  const noap=[], insuf=[];
  STRIDE.forEach(c=>{ const d=R.amenazas[c.k]; if(!d) return; d.no_aplica.forEach(x=>noap.push({cat:c.k,...x})); d.informacion_insuficiente.forEach(x=>insuf.push(`${c.k} · ${x}`)); });
  const errs=Object.keys(R.errores||{});
  $('#ai-report').innerHTML = `
  <div class="stack report">
    ${!C.suficiente&&!list.length?`<div class="qbox"><h3>Kora necesita más contexto</h3>
      <ol>${C.preguntas_criticas.map(q=>`<li>${esc(q)}</li>`).join('')}</ol>
      <div class="actions"><button class="btn" data-ai="answer">Responder las preguntas</button><button class="btn ghost" data-ai="skip">Continuar con supuestos</button></div></div>`:''}
    ${errs.length?`<div class="errbox">Algunas partes fallaron: ${errs.map(k=>`<button class="chip" data-retry="${k}">Reintentar ${k==='plan'?'plan':k+' · '+catOf(k).es}</button>`).join(' ')}</div>`:''}
    ${P?`<div><h2>Resumen ejecutivo</h2><p class="lead flush">${esc(P.resumen_ejecutivo)}</p></div>`:''}
    ${list.length?`<div class="stats">
      <div class="stat"><b>${list.length}</b>amenazas</div>
      <div class="stat"><b class="c-alta">${list.filter(t=>t.riesgo==='Alto').length}</b>riesgo alto</div>
      <div class="stat"><b class="c-media">${list.filter(t=>t.riesgo==='Medio').length}</b>medio</div>
      <div class="stat"><b class="c-baja">${list.filter(t=>t.riesgo==='Bajo').length}</b>bajo</div>
      ${P?`<div class="stat"><b class="c-alta">${P.priorizacion.filter(p=>p.bloqueante).length}</b>bloqueantes</div>`:''}
    </div>`:''}
    <details ${list.length?'':'open'}><summary><h3>Descomposición del sistema</h3></summary>
      <div class="decomp">
        <p>${esc(C.resumen)}</p>
        <div class="row2">
          <div><div class="kicker">Actores / entidades externas</div>${els(C.actores)}</div>
          <div><div class="kicker">Procesos</div>${els(C.procesos)}</div>
          <div><div class="kicker">Almacenes de datos</div>${els(C.almacenes)}</div>
          <div><div class="kicker">Límites de confianza</div>${els(C.limites_confianza)}</div>
        </div>
        <div class="kicker">Flujos de datos</div>
        <div class="scroll"><table><thead><tr><th>Origen</th><th>Destino</th><th>Datos</th><th>Cruza límite</th></tr></thead><tbody>
        ${C.flujos.map(f=>`<tr><td>${esc(f.origen)}</td><td>${esc(f.destino)}</td><td>${esc(f.datos)}</td><td>${f.cruza_limite?esc(f.cruza_limite):'—'}</td></tr>`).join('')}</tbody></table></div>
        <div class="row2"><div><div class="kicker">Activos críticos</div>${li(C.activos_criticos)}</div><div><div class="kicker">Superficie de ataque</div>${li(C.superficie_ataque)}</div></div>
        ${C.suficiente&&C.preguntas_criticas.length?`<div class="kicker">Preguntas que conviene responder</div>${li(C.preguntas_criticas)}`:''}
      </div></details>
    ${list.length?`<div><h3>Tabla de amenazas</h3><p class="note below">Ordenada por riesgo (impacto × probabilidad).</p>
      <div class="scroll"><table class="tm"><thead><tr><th>ID</th><th>Componente</th><th>STRIDE</th><th>Amenaza</th><th>Impacto</th><th>Prob.</th><th>Riesgo</th><th>Mitigación propuesta</th></tr></thead><tbody>
      ${list.map(t=>`<tr><td class="mono">${t.id}${pri[t.id]&&pri[t.id].bloqueante?'<br><span class="pill Alta">bloqueante</span>':''}</td><td>${esc(t.componente)}</td><td class="mono" title="${catOf(t.cat).es}">${t.cat}</td><td>${esc(t.descripcion)}</td><td>${t.impacto}</td><td>${t.probabilidad}</td><td><span class="pill ${sevOf(t.riesgo)}">${t.riesgo}</span></td><td>${esc(t.mitigacion)}</td></tr>`).join('')}
      </tbody></table></div></div>`:''}
    ${P?`<div><h3>Priorización</h3><div class="scroll"><table><thead><tr><th>ID</th><th>Estado</th><th>Razón</th></tr></thead><tbody>
      ${P.priorizacion.map(p=>`<tr><td class="mono">${esc(p.id)}</td><td>${p.bloqueante?'<span class="pill Alta">Bloqueante</span>':'<span class="pill Baja">Con seguimiento</span>'}</td><td>${esc(p.razon)}</td></tr>`).join('')}</tbody></table></div></div>
      <div><h3>Recomendaciones de mitigación</h3><div class="scroll"><table><thead><tr><th>ID</th><th>Tipo</th><th>Control</th></tr></thead><tbody>
      ${recs.map(r=>`<tr><td class="mono">${esc(r.id)}</td><td><span class="tag">${r.tipo}</span></td><td>${esc(r.control)}</td></tr>`).join('')}</tbody></table></div></div>`:''}
    ${noap.length?`<details><summary><h3>Categorías que no aplican (${noap.length})</h3></summary><div class="scroll"><table><thead><tr><th>STRIDE</th><th>Componente</th><th>Justificación</th></tr></thead><tbody>
      ${noap.map(x=>`<tr><td class="mono">${x.cat}</td><td>${esc(x.componente)}</td><td>${esc(x.justificacion)}</td></tr>`).join('')}</tbody></table></div></details>`:''}
    ${insuf.length?`<div><h3>Información insuficiente</h3>${li(insuf)}</div>`:''}
    ${P?`<div><h3>Supuestos asumidos</h3>${li(P.supuestos)}</div>`:''}
    ${list.length?`<div class="actions"><button class="btn" data-ai="md">Copiar como Markdown</button><button class="btn ghost" data-ai="import">Llevar a mi modelo (pasos 2 a 4)</button></div>
      <textarea id="ai-md" class="md-out" hidden readonly></textarea>`:''}
  </div>`;
}
const sevOf=r=>({Alto:'Alta',Medio:'Media',Bajo:'Baja'})[r];

function aiMarkdown(){
  const A=S.ai, R=A.res, C=R.contexto, P=R.plan, list=allThreats(), pri={}; (P?P.priorizacion:[]).forEach(p=>pri[p.id]=p);
  const cell=s=>String(s??'').replace(/\|/g,'/').replace(/\n/g,' ');
  const L=[`# Modelo de amenazas STRIDE: ${A.proyecto.nombre||'Mi proyecto'}`,''];
  if(P) L.push('## Resumen ejecutivo','',P.resumen_ejecutivo,'');
  L.push('## Descomposición del sistema','',C.resumen,'');
  [['Actores',C.actores],['Procesos',C.procesos],['Almacenes de datos',C.almacenes],['Límites de confianza',C.limites_confianza]].forEach(([t,a])=>{ L.push(`### ${t}`,...a.map(x=>`- **${x.nombre}**: ${x.descripcion}`),''); });
  L.push('### Flujos de datos','','| Origen | Destino | Datos | Cruza límite |','|---|---|---|---|',...C.flujos.map(f=>`| ${cell(f.origen)} | ${cell(f.destino)} | ${cell(f.datos)} | ${cell(f.cruza_limite)||'—'} |`),'');
  L.push('## Tabla de amenazas','','| ID | Componente | Categoría STRIDE | Descripción de la amenaza | Impacto | Probabilidad | Riesgo | Mitigación propuesta |','|---|---|---|---|---|---|---|---|',
    ...list.map(t=>`| ${t.id}${pri[t.id]&&pri[t.id].bloqueante?' (bloqueante)':''} | ${cell(t.componente)} | ${t.cat} – ${catOf(t.cat).en} | ${cell(t.descripcion)} | ${t.impacto} | ${t.probabilidad} | ${t.riesgo} | ${cell(t.mitigacion)} |`),'');
  if(P){
    L.push('## Priorización','',...P.priorizacion.map(p=>`- **${p.id}** · ${p.bloqueante?'Bloqueante para producción':'Aceptable con seguimiento'}: ${p.razon}`),'');
    L.push('## Recomendaciones de mitigación','','| ID | Tipo | Control |','|---|---|---|',...P.recomendaciones.map(r=>`| ${r.id} | ${r.tipo} | ${cell(r.control)} |`),'');
    L.push('## Supuestos asumidos','',...P.supuestos.map(s=>`- ${s}`),'');
  }
  return L.join('\n');
}
function aiImport(){
  const R=S.ai.res, C=R.contexto, comps=[], byName={};
  const add=(name,type)=>{ const id=uid(); comps.push({id,name,type}); byName[name.toLowerCase()]=id; };
  C.actores.forEach(x=>add(x.nombre,'ext')); C.procesos.forEach(x=>add(x.nombre,'proc')); C.almacenes.forEach(x=>add(x.nombre,'store'));
  C.flujos.forEach(f=>add(`${f.origen} → ${f.destino}`,'flow'));
  const threats=allThreats().map(t=>{ let id=byName[t.componente.toLowerCase()];
    if(!id){ add(t.componente,'proc'); id=byName[t.componente.toLowerCase()]; }
    return {id:uid(),cat:t.cat,comp:id,sev:sevOf(t.riesgo),desc:`[${t.id}] ${t.descripcion}`,mit:t.mitigacion}; });
  Object.assign(S,{name:S.ai.proyecto.nombre||'Mi proyecto',boundaries:C.limites_confianza.map(b=>b.nombre).join(' · '),components:comps,threats});
  save(); go(3,true);
  say('Pasé tu modelo a los pasos 2 a 4. Ahora puedes <b>editar, borrar o agregar</b> amenazas a mano y revisar la matriz para encontrar huecos.');
}
$('#view').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b||S.step!==5) return;
  if(b.dataset.retry) aiRetry(b.dataset.retry);
  const a=b.dataset.ai; if(!a) return;
  if(a==='skip') aiRun(true);
  else if(a==='answer'){ if(!S.ai.proyecto.respuestas) S.ai.proyecto.respuestas=S.ai.res.contexto.preguntas_criticas.map((q,i)=>`${i+1}. ${q}\n→ `).join('\n'); save(); vAI(); const t=$('#ai-respuestas'); if(t){ t.focus(); t.scrollIntoView({block:'center'}); } }
  else if(a==='md'){ const md=aiMarkdown(), ta=$('#ai-md'); ta.value=md;
    const fb=()=>{ ta.hidden=false; ta.select(); toast('Selecciona y copia el texto'); };
    if(navigator.clipboard) navigator.clipboard.writeText(md).then(()=>toast('Markdown copiado')).catch(fb); else fb(); }
  else if(a==='import') aiImport();
});

if(!S.ai) S.ai=aiDefault(); if(S.step>5) S.step=0;
renderSteps(); render(); say(S.step===2?catSay():STEP_SAY[S.step]);
