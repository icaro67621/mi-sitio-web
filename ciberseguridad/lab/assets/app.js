/* ==========================================================================
 * VulnBank — lógica de la demo (LABORATORIO VULNERABLE A PROPÓSITO)
 *
 * Cada bloque marcado con "VULN:" es un fallo sembrado para el entrenamiento.
 * No usar nada de este archivo como referencia de código seguro.
 * ========================================================================== */

(function () {
  "use strict";

  // VULN (aleatoriedad insegura): Math.random() no es criptográficamente
  // seguro; genera tokens de sesión predecibles. Remediar con
  // crypto.getRandomValues().
  function generarToken() {
    return "sess_" + Math.random().toString(36).slice(2) + Date.now();
  }

  // VULN (autenticación en el cliente + credenciales hardcodeadas):
  // la "validación" ocurre en el navegador contra un usuario y contraseña
  // fijos (ficticios). Cualquiera lee el código y entra. La autenticación
  // debe hacerse en el servidor.
  var USUARIO_DEMO = "admin";
  var CLAVE_DEMO = "V8lnB@nk#Str0ng_2026"; // ficticia, solo para el lab

  function login(form) {
    var u = form.usuario.value;
    var p = form.clave.value;
    if (u === USUARIO_DEMO && p === CLAVE_DEMO) {
      try { sessionStorage.setItem("vb_token", generarToken()); } catch (e) {}
      document.getElementById("panel").hidden = false;
      document.getElementById("acceso").hidden = true;
      document.getElementById("hola").textContent = "Hola, " + u;
    } else {
      document.getElementById("login-msg").textContent = "Credenciales inválidas.";
    }
    return false;
  }

  // VULN (XSS por DOM): el término de búsqueda se inserta con innerHTML sin
  // sanear. Un valor como <img src=x onerror=...> ejecuta scripts.
  // Remediar usando textContent o sanitizando la entrada.
  function buscar(form) {
    var q = form.q.value;
    document.getElementById("resultado").innerHTML =
      "Resultados para: <b>" + q + "</b>";
    return false;
  }

  // VULN (XSS por DOM desde la URL): el fragmento (#...) se refleja con
  // innerHTML. Enlace malicioso: .../app.html#<img src=x onerror=...>
  function pintarDesdeHash() {
    if (location.hash.length > 1) {
      var aviso = decodeURIComponent(location.hash.slice(1));
      document.getElementById("banner").innerHTML = aviso;
    }
  }

  // VULN (eval con entrada del usuario): evaluar expresiones del usuario con
  // eval permite ejecución de código arbitrario. Remediar con un parser
  // seguro o eliminando la función.
  function calcular(form) {
    var expr = form.expr.value;
    try {
      document.getElementById("calc-out").textContent = "= " + eval(expr);
    } catch (e) {
      document.getElementById("calc-out").textContent = "Error";
    }
    return false;
  }

  // VULN (mixed content / exfiltración a endpoint HTTP): envía datos a un
  // endpoint por HTTP inseguro tomado de la configuración.
  function enviarMetrica() {
    try {
      new Image().src =
        window.APP_CONFIG.reportingEndpoint + "?t=" +
        encodeURIComponent(sessionStorage.getItem("vb_token") || "");
    } catch (e) {}
  }

  window.VulnBank = { login: login, buscar: buscar, calcular: calcular };

  document.addEventListener("DOMContentLoaded", function () {
    pintarDesdeHash();
    window.addEventListener("hashchange", pintarDesdeHash);
    enviarMetrica();
  });
})();
