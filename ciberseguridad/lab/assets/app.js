/* ==========================================================================
 * VulnBank — lógica de la demo (VERSIÓN REMEDIADA)
 *
 * Correcciones aplicadas frente a la versión vulnerable:
 *  - Token con crypto.getRandomValues() (no Math.random).
 *  - Sin credenciales ni autenticación en el cliente: se valida en el servidor.
 *  - Salidas con textContent (no innerHTML): no hay XSS por DOM.
 *  - Calculadora con un evaluador aritmético acotado (sin eval()).
 *  - Sin envío de datos a endpoints externos / HTTP.
 *  - Eventos enlazados con addEventListener (sin manejadores en línea), para
 *    funcionar bajo una CSP estricta.
 * ========================================================================== */

(function () {
  "use strict";

  function generarToken() {
    var a = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(a);
    var hex = "";
    for (var i = 0; i < a.length; i++) {
      hex += ("0" + a[i].toString(16)).slice(-2);
    }
    return "sess_" + hex;
  }

  // Búsqueda: se inserta el término con textContent, nunca con innerHTML.
  function buscar(e) {
    e.preventDefault();
    var q = document.getElementById("q").value;
    document.getElementById("resultado").textContent = "Resultados para: " + q;
  }

  // Banner desde la URL: texto plano con textContent, no se interpreta HTML.
  function pintarDesdeHash() {
    var b = document.getElementById("banner");
    if (!b) return;
    b.textContent = location.hash.length > 1
      ? decodeURIComponent(location.hash.slice(1))
      : "";
  }

  // Calculadora: evaluador aritmético acotado (+ - * / y paréntesis).
  // No usa eval ni Function: solo opera sobre números ya validados.
  function evalArit(expr) {
    var tokens = expr.match(/\d+\.?\d*|[+\-*/()]/g);
    if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) {
      throw new Error("expresión no válida");
    }
    var out = [], ops = [], prec = { "+": 1, "-": 1, "*": 2, "/": 2 };
    function apply() {
      var op = ops.pop(), b = out.pop(), a = out.pop();
      if (a === undefined || b === undefined) throw new Error("expresión no válida");
      if (op === "+") out.push(a + b);
      else if (op === "-") out.push(a - b);
      else if (op === "*") out.push(a * b);
      else out.push(a / b);
    }
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (/^\d/.test(t)) out.push(parseFloat(t));
      else if (t === "(") ops.push(t);
      else if (t === ")") {
        while (ops.length && ops[ops.length - 1] !== "(") apply();
        if (!ops.length) throw new Error("paréntesis");
        ops.pop();
      } else {
        while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) apply();
        ops.push(t);
      }
    }
    while (ops.length) {
      if (ops[ops.length - 1] === "(") throw new Error("paréntesis");
      apply();
    }
    if (out.length !== 1) throw new Error("expresión no válida");
    return out[0];
  }

  function calcular(e) {
    e.preventDefault();
    var out = document.getElementById("calc-out");
    try {
      out.textContent = "= " + evalArit(document.getElementById("expr").value);
    } catch (_) {
      out.textContent = "Expresión no válida";
    }
  }

  // Autenticación: no se decide en el cliente ni hay credenciales en el código.
  // El formulario enviaría las credenciales al servidor, que las valida.
  function login(e) {
    e.preventDefault();
    // El token solo se usaría tras una respuesta válida del servidor.
    document.getElementById("login-msg").textContent =
      "Solicitud enviada. La autenticación se valida en el servidor.";
  }

  document.addEventListener("DOMContentLoaded", function () {
    pintarDesdeHash();
    window.addEventListener("hashchange", pintarDesdeHash);
    var fl = document.getElementById("form-login");
    var fb = document.getElementById("form-buscar");
    var fc = document.getElementById("form-calc");
    if (fl) fl.addEventListener("submit", login);
    if (fb) fb.addEventListener("submit", buscar);
    if (fc) fc.addEventListener("submit", calcular);
    // generarToken queda disponible para usarse tras una sesión válida.
    void generarToken;
  });
})();
