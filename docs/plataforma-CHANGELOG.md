# Changelog — plataforma

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Se documentan las políticas reales de `mali-one-ec2-role` (SES/SQS + S3) y se
  aclara que `S3_PUBLIC_READ` no abre el bucket: hace falta bucket policy /
  Block Public Access.

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- Baseline: Docker Compose, NPM, OAuth, S3, migraciones documentados desde README.
