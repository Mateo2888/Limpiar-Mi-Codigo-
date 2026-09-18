# AI Code Cleaner

Elimina los comentarios de relleno que dejan los agentes de IA (`// Verificar si el usuario existe`,
`// Devolver la respuesta`, etc.) sin tocar la lógica, los nombres ni el estilo de tu código.

> **NO MEJORES MI CÓDIGO. SOLO QUÍTALE EL RUIDO.**

Gratuito y de código abierto. Funciona 100% local — no envía tu código a ningún servicio
externo, no usa IA/LLM para decidir qué borrar (reglas deterministas), y siempre puedes
ver el diff y aceptar o rechazar antes de que se aplique un cambio.

## Estado

MVP funcional (ver `PROGRESS.md`): motor, extensión de VS Code y CLI ya funcionan y
tienen pruebas automatizadas en verde. Todavía no hay una versión empaquetada/publicada
para instalar directamente desde el Marketplace o npm — hay que correrla desde el
código fuente (ver `CLAUDE.md`).

## Qué hace

- Detecta comentarios que solo parafrasean literalmente la línea de código siguiente
  (típico de agentes de IA) y los marca para eliminar.
- Conserva comentarios que explican una decisión de negocio, una limitación externa,
  un workaround, o cualquier cosa no evidente desde el código — ante la duda, conserva.
- Nunca cambia lógica, nombres, imports, tipos, condiciones ni formato.
- Comandos manuales en VS Code (`Clean Current File`, `Preview Changes`,
  `Clean Selection`, `Restore`), todos con diff antes de aplicar y deshacer disponible.
- Modo automático (opcional): sugiere eliminar un comentario redundante justo después de
  que lo escribes, vía CodeLens; no borra nada por su cuenta salvo que actives
  explícitamente `aiCodeCleaner.liveMode.autoApply`.
- CLI (`ai-code-cleaner`) para correr el mismo motor desde terminal o CI: dry-run,
  `--write`, `--check`. Ver `packages/cli/README.md`.

## Lenguajes soportados (MVP)

- TypeScript / JavaScript
- Python

Arquitectura pensada para agregar más lenguajes sin duplicar lógica (ver `CLAUDE.md`).

## Instalación

Pendiente de la primera versión publicable (FASE 3 en adelante).

## Desarrollo

Ver `CLAUDE.md` para arquitectura, decisiones y comandos de verificación.

## Licencia

Apache-2.0 (ver `LICENSE`).
