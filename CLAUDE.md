# Instrucciones para Claude en este repositorio

Sitio estático en Azure Static Web Apps (se publica al hacer push a `main`).
La sección `/ciberseguridad` tiene laboratorios de seguridad con dos versiones.

## Lab 02 · Seguridad en APIs (VulnBank API)

- API real (Azure Functions) en `api/lab/index.js`, servida en `/api/lab/...`.
- Fuentes de cada versión: `labs/api-lab/vuln/index.js` y `labs/api-lab/clean/index.js`.
- Manual: `labs/api-lab/MANUAL.md` (y su PDF `labs/api-lab/Manual-Lab-API.pdf`).

Cuando el usuario diga **"coloca el laboratorio de API vulnerable"** (o similar):

```bash
bash tools/switch-api-lab.sh vuln
```

Cuando diga **"coloca el laboratorio de API endurecida"** / "con las vulnerabilidades
resueltas" / "limpia" / "corregida":

```bash
bash tools/switch-api-lab.sh clean
```

El script copia la versión a `api/lab/index.js` y ejecuta `node tools/check-api-lab.js`,
que debe terminar con "✔ Todo coincide con el manual". Después: commit de
`api/lab/index.js` y push (pedir "coloca" equivale a pedir que se publique en `main`).
Para saber cuál está activa: `bash tools/switch-api-lab.sh status`.

Si se cambia algún fallo del código, actualizar también `tools/check-api-lab.js`,
el manual y regenerar el PDF.

## Lab 03 · Remediación (VulnBank web)

`bash tools/switch-lab.sh vuln|clean` (ramas base `lab-vuln-baseline` / `lab-clean-baseline`).
