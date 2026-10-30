// Consola del laboratorio de APIs. Solo envía peticiones a /api/lab/ del
// propio sitio y muestra las respuestas como texto (nunca como HTML).
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var out = $('response');
  var meta = $('meta');

  function show(text) { out.textContent = text; }

  function send(method, path, bodyText) {
    if (!/^\/api\/lab(\/|$|\?)/.test(path)) {
      show('La consola solo envía peticiones a /api/lab/…');
      return Promise.resolve(null);
    }
    var headers = {};
    var token = $('token').value.trim();
    if (token) headers.Authorization = 'Bearer ' + token;
    var opts = { method: method, headers: headers };
    if (bodyText && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      opts.body = bodyText;
    }
    meta.textContent = 'enviando…';
    var t0 = performance.now();
    return fetch(path, opts).then(function (r) {
      return r.text().then(function (text) {
        var ms = Math.round(performance.now() - t0);
        meta.textContent = 'HTTP ' + r.status + ' · ' + ms + ' ms · ' + text.length + ' bytes';
        var interesting = ['content-type', 'access-control-allow-origin', 'access-control-allow-credentials', 'x-powered-by', 'retry-after'];
        var head = interesting.filter(function (h) { return r.headers.get(h); })
          .map(function (h) { return h + ': ' + r.headers.get(h); }).join('\n');
        var shown = text.length > 20000 ? text.slice(0, 20000) + '\n… (respuesta recortada en pantalla: ' + text.length + ' bytes en total)' : text;
        show('HTTP ' + r.status + '\n' + head + '\n\n' + shown);
        try { return JSON.parse(text); } catch (e) { return null; }
      });
    }).catch(function (e) {
      meta.textContent = '';
      show('Error de red: ' + e.message);
      return null;
    });
  }

  $('btn-send').addEventListener('click', function () {
    send($('method').value, $('path').value.trim(), $('body').value.trim());
  });

  $('btn-login').addEventListener('click', function () {
    send('POST', '/api/lab/auth/login', JSON.stringify({ username: 'laura', password: 'Laura2026!' }))
      .then(function (j) { if (j && j.token) $('token').value = j.token; });
  });

  $('btn-reset').addEventListener('click', function () { send('POST', '/api/lab/reset', ''); });

  $('presets').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    $('method').value = b.getAttribute('data-m');
    $('path').value = b.getAttribute('data-p');
    $('body').value = b.getAttribute('data-b') || '';
  });

  // Indicador de la versión activa.
  var badge = $('api-version');
  fetch('/api/lab/version').then(function (r) { return r.json(); }).then(function (j) {
    var v = String(j.version || '').toUpperCase();
    badge.textContent = v || 'DESCONOCIDA';
    badge.className = 'badge ' + (j.version === 'vulnerable' ? 'red' : '');
  }).catch(function () {
    badge.textContent = 'NO DISPONIBLE';
    badge.className = 'badge blue';
  });
})();
