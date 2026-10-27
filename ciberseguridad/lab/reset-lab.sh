#!/usr/bin/env bash
# Restaura el laboratorio al estado VULNERABLE original, para volver a
# practicar la remediacion cuantas veces quieras.
#
# Uso:  bash ciberseguridad/lab/reset-lab.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

BASE="lab-vuln-baseline"

if git rev-parse -q --verify "refs/tags/$BASE" >/dev/null; then
  # Restaura los archivos del lab desde la etiqueta del estado vulnerable.
  git checkout "$BASE" -- ciberseguridad/lab
  echo "✔ Laboratorio restaurado al estado vulnerable (desde la etiqueta $BASE)."
else
  echo "No existe la etiqueta '$BASE'."
  echo "Si aun no has hecho commit de la remediacion, puedes descartar los cambios con:"
  echo "    git restore ciberseguridad/lab"
  exit 1
fi

echo "Revisa el estado con:  git status"
echo "Para publicar de nuevo el estado vulnerable, haz commit y push de ciberseguridad/lab."
