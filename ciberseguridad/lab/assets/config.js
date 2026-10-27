/* ==========================================================================
 * VulnBank — configuración (VERSIÓN REMEDIADA)
 *
 * Sin secretos en el cliente. En producción, las claves y contraseñas viven
 * en variables de entorno o en un gestor de secretos del lado del servidor,
 * nunca en el código que se entrega al navegador.
 * ========================================================================== */

window.APP_CONFIG = {
  env: "production",
  // Solo configuración pública, sin credenciales. Las llamadas autenticadas
  // se realizan desde el backend, que es quien guarda los secretos.
  apiBaseUrl: "/api"
};
