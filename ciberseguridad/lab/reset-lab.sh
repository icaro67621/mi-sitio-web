#!/usr/bin/env bash
# Restaura el laboratorio al estado VULNERABLE original, para volver a
# practicar la remediacion cuantas veces quieras.
#
# Uso:  bash ciberseguridad/lab/reset-lab.sh
# (Equivale a: bash tools/switch-lab.sh vuln)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec bash tools/switch-lab.sh vuln
