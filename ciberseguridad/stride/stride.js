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
  'Modo práctica. Te muestro un escenario y tú eliges la categoría STRIDE. Algunos casos tocan más de una; elige la <b>principal</b> y te explico por qué.'
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
const STEPS = [['1','Conoce STRIDE'],['2','Describe tu sistema'],['3','Analiza'],['4','Plan de mitigación'],['','Práctica']];
function renderSteps(){
  $('#steps').innerHTML = STEPS.map((s,i)=>`<button role="tab" class="step${i===4?' practice':''}" aria-selected="${S.step===i}" data-step="${i}">${s[0]?`<span class="n">0${s[0]}</span>`:'<span class="n">◇</span>'}${s[1]}</button>`).join('');
}
$('#steps').addEventListener('click',e=>{ const b=e.target.closest('[data-step]'); if(b) go(+b.dataset.step); });
function go(i,quiet){ S.step=i; save(); renderSteps(); render(); if(!quiet) say(i===2?catSay():STEP_SAY[i]); window.scrollTo({top:0,behavior:reduce?'auto':'smooth'}); }
const catOf = k=>STRIDE.find(c=>c.k===k);
const catSay = ()=>catOf(S.cat).say;
const compName = id=>(S.components.find(c=>c.id===id)||{name:'(elemento eliminado)'}).name;

function render(){ [vIntro,vSystem,vAnalyze,vPlan,vQuiz][S.step](); }

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

renderSteps(); render(); say(S.step===2?catSay():STEP_SAY[S.step]);
