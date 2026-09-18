# Progreso

Formato: fase, qué está hecho, qué falta. Actualizar al cerrar cada incremento.

## FASE 0 — Investigación ✅

- Prior art revisada: `Goldziher/uncomment` (Rust, tree-sitter, MIT, borrado por categoría
  sin heurística de paráfrasis), extensiones de marketplace existentes (`Remove IA Comments`,
  `CommentsCleaner`, etc. — todas manuales, sin diff estructurado ni modo automático).
- Confirmado: tree-sitter (`web-tree-sitter`, WASM) es la opción correcta frente a
  compiler APIs por lenguaje o regex. Detalle en `docs/decisions.md`.

## FASE 1 — Diseño ✅

- Arquitectura de paquetes definida (`core` / `languages/*` / `vscode` / `cli`).
- Dos modos de uso definidos: manual (comando + diff) y automático (live watcher con
  sugerencia, no borrado silencioso por defecto).
- Heurística v1 definida: paráfrasis de la línea siguiente + lista de exclusiones.
- Estrategia de pruebas definida: fixtures input/expected + test de invariancia estructural.

## FASE 2 — Harness ✅ (este commit)

- `CLAUDE.md`, `README.md`, `PROGRESS.md`, `docs/decisions.md` creados.
- Estructura de paquetes creada (vacía, solo `package.json` + `tsconfig` por paquete).
- Fixtures de test creadas para TypeScript cubriendo los 12 casos del enunciado
  (`tests/fixtures/typescript/*`). **Pendiente**: fixtures equivalentes para Python.
- Tooling raíz: npm workspaces, `biome.json`, `tsconfig.base.json`, `.gitignore`,
  hook de pre-commit local (`.githooks/pre-commit`, sin husky).
- **No hay motor de limpieza implementado todavía** — los scripts `npm test` / `npm run
  typecheck` fallarán hasta la FASE 3 porque no existe código en `packages/core`.

## FASE 3 — MVP (en progreso)

- [x] Implementar `packages/core`: heurística de ruido (`rules/redundancy.ts`), motor
      de diff por rangos de bytes (`diffEngine.ts`) y orquestador (`cleaner.ts`).
- [x] Implementar `packages/languages/typescript` con `web-tree-sitter` +
      `tree-sitter-typescript`/`tree-sitter-javascript` (gramáticas `.wasm`, sin
      compilación nativa). Soporta `.ts/.tsx/.js/.jsx` según extensión.
- [x] Los 10 fixtures de `tests/fixtures/typescript/*` pasan, incluida la prueba de
      invariancia estructural (comparar árboles sin nodos de comentario) y la
      verificación de que el resultado sigue siendo sintácticamente válido.
- [x] `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` en verde.
- [ ] Implementar `packages/languages/python` + sus fixtures (siguiente incremento).
- [ ] Implementar `packages/vscode`: comando `Clean Current File` + `Preview Changes` con
      diff nativo de VS Code y aplicar/rechazar vía `WorkspaceEdit`.
- [ ] Implementar modo live (watcher con debounce + CodeLens de sugerencia), detrás de
      configuración (`aiCodeCleaner.liveMode.enabled` / `.autoApply`).

### Decisión de alcance tomada durante la implementación

La regla v1 (`core/src/rules/redundancy.ts`) **no compara el comentario contra los
identificadores de la línea siguiente**, a diferencia de lo esbozado en FASE 1. En la
práctica el código suele estar en inglés y el comentario en español (o al revés), así
que un chequeo de "subconjunto de tokens" fallaba constantemente (falsos negativos).
La regla real es: comentario de línea corto (≤8 palabras) que contiene una palabra
disparadora conocida (verbo imperativo típico de agente de IA, ES/EN) y ninguna palabra
de exclusión (razón/decisión/limitación/workaround/etc.). Ver `docs/decisions.md`.

También se decidió que **solo los comentarios de línea (`//`, `#`) son candidatos** a
la regla de ruido; los de bloque (`/** */`, `/* */`, docstrings) se preservan siempre
en v1 — simplifica el MVP y es la opción más conservadora.

El `LanguageAdapter` (`core/src/types.ts`) terminó siendo **async**: cargar la
gramática WASM de tree-sitter es asíncrono (una sola vez, cacheado), así que
`findComments`/`nextCodeNodeText`/`hasParseErrorNear` devuelven `Promise`. `core/clean()`
también es async por transitividad.

## FASE 4 — Validación (pendiente)

- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` en verde.
- [ ] Prueba manual en VS Code real con archivos reales generados por un agente de IA.

## FASE 5 — CLI (pendiente, después de que el MVP sea estable)

- [ ] `packages/cli` reutilizando `core` + `languages/*` sin duplicar lógica.
