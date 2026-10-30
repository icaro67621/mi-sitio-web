// Indicador de la versión publicada del lab (VULNERABLE / LIMPIA).
// Se deduce del código que realmente está desplegado: la versión vulnerable
// lleva secretos ficticios en assets/config.js; la limpia no.
(function () {
  var badge = document.getElementById('lab-version');
  if (!badge) return;
  fetch('/ciberseguridad/lab/assets/config.js', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (src) {
      var vuln = /paymentsApiKey|jwtSigningSecret|databasePassword/.test(src);
      badge.textContent = vuln ? 'VULNERABLE' : 'LIMPIA (REMEDIADA)';
      badge.className = 'badge ' + (vuln ? 'red' : '');
    })
    .catch(function () {
      badge.textContent = 'NO DISPONIBLE';
      badge.className = 'badge blue';
    });
})();
