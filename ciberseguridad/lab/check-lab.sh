#!/usr/bin/env bash
# Verifica que el laboratorio conserva EXACTAMENTE las 11 vulnerabilidades
# documentadas en el manual (PDF). Si alguna falta, lo reporta y termina con
# error, para detectar que el laboratorio "cambió" respecto a lo documentado.
#
# Uso:  bash ciberseguridad/lab/check-lab.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

LAB="ciberseguridad/lab"
fail=0
ok()   { printf '  [OK]    %s\n' "$1"; }
bad()  { printf '  [FALTA] %s\n' "$1"; fail=1; }

chk() { # descripción  archivo  patrón(regex)
  if grep -qE "$3" "$2" 2>/dev/null; then ok "$1"; else bad "$1 ($2)"; fi
}

echo "Verificando vulnerabilidades documentadas del lab..."

# 1. Secretos ficticios hardcodeados (4 claves)
n=$(grep -cE 'paymentsApiKey|storageSecretAccessKey|jwtSigningSecret|databasePassword' "$LAB/assets/config.js" 2>/dev/null)
if [ "${n:-0}" -ge 4 ]; then ok "1. Secretos hardcodeados (config.js)"; else bad "1. Secretos hardcodeados (config.js)"; fi
# 2. XSS por DOM en la búsqueda
chk "2. XSS por DOM en búsqueda (app.js)"        "$LAB/assets/app.js"  'getElementById\("resultado"\)\.innerHTML'
# 3. XSS por DOM desde la URL (hash)
chk "3. XSS por DOM desde la URL (app.js)"       "$LAB/assets/app.js"  'location\.hash'
# 4. eval() con entrada del usuario
chk "4. eval() con entrada del usuario (app.js)" "$LAB/assets/app.js"  'eval\('
# 5. Token con Math.random
chk "5. Token con Math.random (app.js)"          "$LAB/assets/app.js"  'Math\.random'
# 6. Credenciales fijas / auth en cliente
chk "6. Credenciales fijas (app.js)"             "$LAB/assets/app.js"  'Admin123!'
# 7. jQuery 1.7.2 vulnerable
chk "7. jQuery 1.7.2 (app.html)"                 "$LAB/app.html"       'jquery/1\.7\.2'
# 8. Script externo sin SRI (jQuery sin integrity)
if grep -q 'jquery/1.7.2' "$LAB/app.html" 2>/dev/null && ! grep 'jquery/1.7.2' "$LAB/app.html" | grep -q 'integrity='; then
  ok "8. Script externo sin SRI (app.html)"; else bad "8. Script externo sin SRI (app.html)"; fi
# 9. Mixed content / endpoint HTTP
chk "9. Mixed content HTTP (config.js)"          "$LAB/assets/config.js" 'http://reports\.vulnbank\.local'
# 10. Dependencias con CVE
chk "10. Dependencias con CVE (package.json)"    "$LAB/package.json"   '"lodash": "4\.17\.4"'
# 11. CSP débil en la ruta del lab
chk "11. CSP débil del lab (staticwebapp.config.json)" "staticwebapp.config.json" "ciberseguridad/lab/\\*"

echo
if [ "$fail" -eq 0 ]; then
  echo "✔ Las 11 vulnerabilidades documentadas están presentes."
else
  echo "✘ ATENCIÓN: el laboratorio NO coincide con el manual (hay fallos ausentes)."
  echo "  Revisa si remediaste sin reiniciar, o actualiza el manual/PDF."
fi
exit "$fail"
