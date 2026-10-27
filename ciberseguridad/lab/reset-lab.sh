#!/usr/bin/env bash
# Restaura el laboratorio al estado VULNERABLE original, para volver a
# practicar la remediacion cuantas veces quieras.
#
# Uso:  bash ciberseguridad/lab/reset-lab.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Referencia del estado vulnerable base. Puede ser una etiqueta o una rama,
# local o remota (origin/). Se usa la primera que exista.
NAME="lab-vuln-baseline"
BASE=""
for ref in "refs/tags/$NAME" "refs/heads/$NAME" "refs/remotes/origin/$NAME"; do
  if git rev-parse -q --verify "$ref" >/dev/null; then BASE="$ref"; break; fi
done

if [ -z "$BASE" ]; then
  echo "No encuentro la referencia base '$NAME' (ni etiqueta ni rama)."
  echo "Si aun NO has hecho commit de la remediacion, descarta los cambios con:"
  echo "    git restore ciberseguridad/lab"
  echo "Si ya la publicaste, trae la rama base con:  git fetch origin $NAME"
  exit 1
fi

git checkout "$BASE" -- ciberseguridad/lab
echo "✔ Laboratorio restaurado al estado vulnerable (desde $BASE)."
echo "Revisa el estado con:  git status"
echo "Para publicar de nuevo el estado vulnerable, haz commit y push de ciberseguridad/lab."
