# Lab de Remediación — Guía del instructor

> Material de clase. Lista los fallos **sembrados a propósito** en `ciberseguridad/lab/`
> y cómo se remedian. Todos los secretos son **ficticios**.

Este laboratorio es un sitio **estático** (Azure Static Web Apps, sin backend). Por eso
los fallos son del lado del cliente o de configuración/dependencias. Varios no se
"ejecutan" pero sí los marcan las herramientas SAST / SCA / escáneres de secretos, que es
justo lo que se quiere demostrar.

## Fallos sembrados

| # | Archivo | Tipo | Detecta | Remediación |
|---|---------|------|---------|-------------|
| 1 | `assets/config.js` | Secreto hardcodeado: clave de pagos ficticia | Secret scanning (gitleaks, trufflehog) | Mover a variable de entorno / gestor de secretos; rotar la clave |
| 2 | `assets/config.js` | Secreto: credenciales de almacenamiento tipo nube | Secret scanning | Igual que arriba; nunca exponer en el cliente |
| 3 | `assets/config.js` | Secreto: secreto de firma de JWT | Secret scanning | Firmar solo en el servidor; no enviar el secreto al navegador |
| 4 | `assets/config.js` | Secreto: contraseña de base de datos en texto plano | Secret scanning | Credenciales solo en el backend |
| 5 | `assets/config.js` + `assets/app.js` | Mixed content (endpoint HTTP) | ZAP, revisión manual | Usar HTTPS; mejor, no enviar el token |
| 6 | `assets/app.js` | XSS por DOM (búsqueda con `innerHTML`) | SAST (Semgrep, CodeQL) | Usar `textContent` o sanitizar |
| 7 | `assets/app.js` | XSS por DOM desde `location.hash` | SAST | No reflejar la URL con `innerHTML` |
| 8 | `assets/app.js` | `eval()` con entrada del usuario | SAST | Eliminar `eval`; usar un parser seguro |
| 9 | `assets/app.js` | Aleatoriedad insegura (`Math.random`) para token | SAST | `crypto.getRandomValues()`; tokens en el servidor |
| 10 | `assets/app.js` + `app.html` | Autenticación y credenciales en el cliente | SAST / revisión | Autenticar en el servidor |
| 11 | `app.html` | jQuery 1.7.2 (librería vulnerable) | SCA / retire.js | Actualizar a una versión soportada |
| 12 | `app.html` | Script externo sin SRI | SAST / revisión | Añadir `integrity` + `crossorigin` |
| 13 | `app.html` | `target="_blank"` sin `rel="noopener"` | SAST / linters | Añadir `rel="noopener noreferrer"` |
| 14 | `package.json` | Dependencias con CVE (lodash, marked, etc.) | SCA (npm audit, Dependabot, Snyk, Trivy) | Subir a versiones parcheadas |
| 15 | `staticwebapp.config.json` (ruta del lab) | CSP débil en `/ciberseguridad/lab/*` | Revisión / securityheaders.com | Endurecer la CSP de esa ruta |

## Flujo de la demostración

1. Estado de partida = **vulnerable** (el commit base, etiqueta `lab-vuln-baseline`).
2. Pasar la carpeta a Claude y pedir la remediación.
3. Verificar con el escáner elegido que los hallazgos bajan.
4. Restaurar para repetir:

   ```bash
   bash ciberseguridad/lab/reset-lab.sh
   ```

## Nota de alcance (importante)

Este lab se sirve en el **mismo dominio** que el sitio real. Para una demostración
aislada es preferible publicarlo en un hosting aparte (o local con `python3 -m http.server`).
Ver la conversación con Claude para las recomendaciones de aislamiento.
