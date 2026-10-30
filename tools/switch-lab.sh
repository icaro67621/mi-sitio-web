#!/usr/bin/env bash
# Cambia el laboratorio entre la versión VULNERABLE y la LIMPIA (remediada).
#
# Uso:
#   bash tools/switch-lab.sh vuln     # pone la versión vulnerable
#   bash tools/switch-lab.sh clean    # pone la versión limpia (remediada)
#
# Restaura solo los archivos que cambian entre versiones desde la rama base
# correspondiente. Después hay que hacer commit y push a main para desplegar.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

case "${1:-}" in
  vuln|vulnerable) REF="lab-vuln-baseline";  NAME="VULNERABLE";;
  clean|limpia|limpio) REF="lab-clean-baseline"; NAME="LIMPIA (remediada)";;
  *) echo "Uso: bash tools/switch-lab.sh vuln|clean"; exit 2;;
esac

# Resuelve la rama base (local o remota).
SRC=""
for r in "refs/heads/$REF" "refs/remotes/origin/$REF"; do
  if git rev-parse -q --verify "$r" >/dev/null; then SRC="$r"; break; fi
done
if [ -z "$SRC" ]; then
  echo "No encuentro la rama base '$REF'. Prueba:  git fetch origin $REF"
  exit 1
fi

# Solo estos archivos difieren entre la versión vulnerable y la limpia.
PATHS=(
  "ciberseguridad/lab/app.html"
  "ciberseguridad/lab/assets"
  "ciberseguridad/lab/package.json"
)

git checkout "$SRC" -- "${PATHS[@]}"

# staticwebapp.config.json NO se restaura entero (tiene configuración de otros
# laboratorios); solo se pone o se quita la CSP débil de /ciberseguridad/lab/*.
MODE="$1" node - <<'NODE'
const fs = require('fs');
const f = 'staticwebapp.config.json';
const c = JSON.parse(fs.readFileSync(f, 'utf8'));
c.routes = c.routes.filter((r) => r.route !== '/ciberseguridad/lab/*');
if (/^vuln/.test(process.env.MODE)) {
  const i = c.routes.findIndex((r) => r.route === '/ciberseguridad/*');
  c.routes.splice(i < 0 ? c.routes.length : i, 0, {
    route: '/ciberseguridad/lab/*',
    headers: {
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data:; img-src 'self' data: http: https:; frame-ancestors 'none'",
    },
  });
}
fs.writeFileSync(f, JSON.stringify(c, null, 2) + '\n');
NODE
PATHS+=("staticwebapp.config.json")

echo "✔ Laboratorio cambiado a la versión $NAME (desde $SRC)."
echo "Archivos actualizados:"
printf '  - %s\n' "${PATHS[@]}"
echo
echo "Para publicar en el sitio:"
echo "  git add -A && git commit -m 'Lab: versión $NAME' && git push origin HEAD:main"
