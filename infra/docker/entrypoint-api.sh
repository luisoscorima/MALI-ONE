#!/bin/sh
set -e

pnpm prisma:migrate

if [ "${WIDGET_SEED_ON_START}" = "true" ]; then
  echo 'WIDGET_SEED_ON_START=true — ejecutando prisma:seed:widgets'
  pnpm prisma:seed:widgets
else
  echo 'Omitiendo seed de widgets (solo con WIDGET_SEED_ON_START=true).'
fi

exec node dist/main.js
