/* ==========================================================================
 * VulnBank — configuración (LABORATORIO VULNERABLE A PROPÓSITO)
 *
 * TODOS los valores de abajo son FICTICIOS e INVENTADOS para el entrenamiento.
 * No son credenciales reales y no dan acceso a ningún servicio. Se usan
 * formatos genéricos (no de un proveedor real) a propósito, para que el lab
 * se pueda desplegar sin que la protección de push de GitHub lo bloquee.
 *
 * VULN (secretos hardcodeados): credenciales y claves dentro del código
 * fuente que se entrega al navegador. Cualquier visitante puede leerlas.
 * Objetivo didáctico: que un escáner de secretos (gitleaks, trufflehog,
 * Semgrep, etc.) las detecte y luego moverlas a variables de entorno / un
 * gestor de secretos.
 * ========================================================================== */

window.APP_CONFIG = {
  env: "production",

  // VULN: clave de API de pagos incrustada en el cliente (ficticia)
  paymentsApiKey: "DEMO-pay-key-a1b2c3d4e5f6a7b8-lab-no-real",

  // VULN: credenciales de almacenamiento incrustadas (ficticias)
  storageAccessKeyId: "DEMOCLOUDKEYID0000LAB",
  storageSecretAccessKey: "demoLABsecret0000ExampleOnlyNotARealKey0000x",

  // VULN: secreto de firma de tokens en el cliente (ficticio)
  jwtSigningSecret: "lab-super-secreto-de-firma-no-usar-en-produccion",

  // VULN: contraseña de base de datos en texto plano (ficticia)
  databaseUser: "vulnbank_app",
  databasePassword: "P4ssw0rd-demo-lab",
  databaseHost: "db.vulnbank.local",

  // VULN: endpoint interno cargado por HTTP (mixed content) — ver app.js
  reportingEndpoint: "http://reports.vulnbank.local/collect"
};
