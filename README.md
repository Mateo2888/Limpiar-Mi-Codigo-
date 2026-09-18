# AI Code Cleaner

Elimina los comentarios de relleno que dejan los agentes de IA (`// Verificar si el usuario existe`,
`// Devolver la respuesta`, etc.) sin tocar la lógica, los nombres ni el estilo de tu código.

> **NO MEJORES MI CÓDIGO. SOLO QUÍTALE EL RUIDO.**

Gratuito y de código abierto. Funciona 100% local — no envía tu código a ningún servicio
externo, no usa IA/LLM para decidir qué borrar (reglas deterministas), y siempre puedes
ver el diff y aceptar o rechazar antes de que se aplique un cambio.

## Estado

En desarrollo (ver `PROGRESS.md`). Todavía no hay build instalable.

## Qué hace

- Detecta comentarios que solo parafrasean literalmente la línea de código siguiente
  (típico de agentes de IA) y los marca para eliminar.
- Conserva comentarios que explican una decisión de negocio, una limitación externa,
  un workaround, o cualquier cosa no evidente desde el código — ante la duda, conserva.
- Nunca cambia lógica, nombres, imports, tipos, condiciones ni formato.
- Modo manual: comando en VS Code para limpiar el archivo actual, con diff antes de aplicar.
- Modo automático (opcional): sugiere eliminar un comentario redundante justo después de
  que lo escribes, sin analizar el resto del archivo.

## Lenguajes soportados (MVP)

- TypeScript / JavaScript
- Python

Arquitectura pensada para agregar más lenguajes sin duplicar lógica (ver `CLAUDE.md`).

## Instalación

Pendiente de la primera versión publicable (FASE 3 en adelante).

## Desarrollo

Ver `CLAUDE.md` para arquitectura, decisiones y comandos de verificación.

## Licencia

MIT (ver `LICENSE`).
