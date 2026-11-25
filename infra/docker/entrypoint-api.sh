#!/bin/sh
set -e

ROLE="${PROCESS_ROLE:-all}"

# Solo el proceso HTTP (o el proceso único `all`) aplica migraciones — evita carreras con api-worker.
if [ "$ROLE" != "worker" ]; then
  pnpm prisma:migrate

  if [ "${WIDGET_SEED_ON_START}" = "true" ]; then
    echo 'WIDGET_SEED_ON_START=true — ejecutando prisma:seed:widgets'
    pnpm prisma:seed:widgets
  else
    echo 'Omitiendo seed de widgets (solo con WIDGET_SEED_ON_START=true).'
  fi
else
  echo "PROCESS_ROLE=worker — omitiendo prisma migrate (lo aplica el proceso HTTP)."
fi

echo "Arrancando API con PROCESS_ROLE=${ROLE}"
exec node dist/main.js
