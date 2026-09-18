# AI Code Cleaner — CLAUDE.md

Orientación rápida para cualquier sesión de Claude Code que retome este proyecto.
Léelo antes de tocar código. Si algo aquí queda desactualizado, corrígelo en el mismo commit que rompe el supuesto.

## Qué es esto

Extensión de VS Code (y luego CLI) que elimina **comentarios de ruido dejados por IAs**
(los que solo parafrasean la línea siguiente) sin tocar lógica, nombres, estructura ni
comentarios que aportan información real. Ver `README.md` para la descripción de usuario
y `docs/decisions.md` para el porqué de cada decisión técnica.

## Filosofía (no negociable)

> "NO MEJORES MI CÓDIGO. SOLO QUÍTALE EL RUIDO."

- Nunca cambia lógica, nombres, imports, tipos ni estilo de formateo.
- Si hay duda razonable sobre si un comentario aporta información → se conserva.
- Determinista y 100% local en v1. **Cero IA/LLM externo** en el motor de detección.
- El usuario siempre puede ver el diff y aceptar/rechazar antes de que algo se aplique
  (salvo que active explícitamente el modo automático).

## Estado actual

Ver `PROGRESS.md` para el detalle fase por fase. Resumen: aún en FASE 2 (harness),
sin motor de limpieza implementado todavía.

## Arquitectura

```
packages/
  core/                # Motor de detección de reglas + generación de diffs. Sin dependencia de vscode.
  languages/
    typescript/        # Adaptador tree-sitter para JS/TS/TSX
    python/             # Adaptador tree-sitter para Python
  vscode/               # Extensión: comandos + modo live (watcher) + UI de diff
  cli/                  # (fase posterior) reutiliza core + languages
```

Regla dura: `core` y `languages/*` **no importan `vscode`**. La extensión es solo una
capa de UI encima del core. Esto permite reusar el mismo motor desde una futura CLI
sin duplicar lógica.

## Decisiones técnicas clave (detalle en docs/decisions.md)

- **Tree-sitter (`web-tree-sitter`, WASM)** para parsear, no regex ni compiler APIs
  por lenguaje. Motivo: tree-sitter conserva nodos de comentario en el árbol, WASM evita
  compilación nativa por plataforma (crítico para distribuir la extensión).
- **Heurística de reglas explícitas y acotadas** (no ML/IA) para decidir "ruido vs. útil".
  Lista corta de patrones, ampliable, con exclusiones explícitas (JSDoc, pragmas, shebangs,
  comentarios largos o con palabras de "razón/decisión/workaround").
- **No se reutiliza el binario de `Goldziher/uncomment`** (Rust, MIT) — es prior art válida
  pero solo borra por categoría, no por paráfrasis, y añadiría un binario externo. Se
  reimplementa el motor en TypeScript puro sobre las mismas gramáticas tree-sitter.
- **Biome** en vez de ESLint+Prettier para el desarrollo del propio repo (una sola
  dependencia cubre lint + format).

## Restricciones duras

1. No modificar: nombres, funciones, clases, condiciones, algoritmos, imports, tipos,
   estructura, comportamiento, APIs, lógica de negocio.
2. No refactorizar ni optimizar código del usuario.
3. No reformatear salvo lo estrictamente necesario para borrar un comentario (su línea
   o su tramo inline), preservando terminadores de línea (LF/CRLF) y líneas en blanco
   vecinas.
4. Nunca depender de una IA/LLM externo en el motor de detección v1.
5. Ante error de parseo o ambigüedad → abstenerse de tocar esa región.

## Cómo ejecutar / verificar (una vez exista implementación)

```bash
npm install
npm test          # corre fixtures de tests/fixtures/** contra el core
npm run lint       # biome check
npm run typecheck  # tsc --noEmit en cada paquete
npm run build      # build de todos los paquetes
```

## Cómo verificar que no se alteró la lógica

Cada fixture en `tests/fixtures/<lenguaje>/<caso>/` tiene `input.*` y `expected.*`.
El test runner (a implementar en FASE 3) debe, además de comparar texto de salida:

1. Parsear `input` y el resultado producido, quitar los nodos de comentario de ambos
   árboles, y comparar que los árboles restantes son estructuralmente idénticos
   (mismo tipo y orden de nodos, mismos rangos de código no-comentario). Esta es la
   prueba de invariancia estructural — si falla, el cambio tocó lógica, no solo comentarios.
2. Verificar que el archivo resultante sigue siendo sintácticamente válido (parsea sin
   errores) tras la transformación.

## Convenciones de trabajo para Claude Code en este repo

- Investigar antes de modificar: leer el archivo existente antes de editarlo.
- Trabajar en incrementos pequeños, un paquete/regla a la vez.
- Correr `npm test` y `npm run typecheck` tras cualquier cambio no trivial.
- Actualizar `PROGRESS.md` al cerrar cada fase o incremento significativo.
- Documentar en `docs/decisions.md` cualquier decisión arquitectónica nueva (no solo
  las ya registradas).
- No agregar dependencias sin justificar por qué en `docs/decisions.md`.
- No usar subagentes para tareas simples de este repo; solo para investigación paralela
  genuina (ej. comparar gramáticas tree-sitter de un lenguaje nuevo).
