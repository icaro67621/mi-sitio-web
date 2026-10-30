#!/usr/bin/env bash
# Cambia el laboratorio de APIs entre la versión VULNERABLE y la ENDURECIDA.
#
# Uso:
#   bash tools/switch-api-lab.sh vuln     # pone la API vulnerable
#   bash tools/switch-api-lab.sh clean    # pone la API endurecida (corregida)
#   bash tools/switch-api-lab.sh status   # dice cuál está puesta ahora
#
# Copia el código de labs/api-lab/<versión>/ a api/lab/ (lo que se despliega)
# y verifica las 12 vulnerabilidades. Después hay que hacer commit y push a main.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ACTIVE="api/lab/index.js"
current() { grep -oE "^const VERSION = '[a-z]+'" "$ACTIVE" | cut -d"'" -f2; }

case "${1:-}" in
  vuln|vulnerable) SRC="labs/api-lab/vuln/index.js";  NAME="VULNERABLE";;
  clean|limpia|limpio|endurecida) SRC="labs/api-lab/clean/index.js"; NAME="ENDURECIDA";;
  status) echo "Versión activa de la API: $(current)"; exit 0;;
  *) echo "Uso: bash tools/switch-api-lab.sh vuln|clean|status"; exit 2;;
esac

cp "$SRC" "$ACTIVE"
echo "✔ API del laboratorio cambiada a la versión $NAME."
echo
node tools/check-api-lab.js active
echo
echo "Para publicar en el sitio:"
echo "  git add api/lab/index.js && git commit -m 'Lab API: versión $NAME' && git push origin HEAD:main"
