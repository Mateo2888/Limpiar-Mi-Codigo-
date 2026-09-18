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
- [x] Implementar `packages/vscode`: comandos `Clean Current File` y `Preview Changes`
      corriendo el motor real sobre el archivo activo, con diff nativo de VS Code
      (`vscode.diff` + documento virtual de solo lectura) y aplicar/descartar vía
      `WorkspaceEdit` (deshacer con Ctrl+Z; aborta si el archivo cambió mientras se
      mostraba el diff). Ver `packages/vscode/README.md`.
- [x] Test de integración end-to-end (`packages/vscode/src/test/`, corre con
      `npm run test:e2e` usando `@vscode/test-electron`): activa la extensión de verdad,
      corre `Preview Changes` sobre un archivo con ruido real, verifica que se abre la
      pestaña de diff. **No se pudo ejecutar dentro de esta sesión** porque el proxy de
      salida del entorno bloquea `update.code.visualstudio.com` (necesario para
      descargar el binario de VS Code); debería funcionar en una máquina normal. Sin
      esto, la UI real de la extensión no quedó verificada visualmente en esta sesión —
      solo compilación, typecheck y el motor puro contra fixtures.
- [x] Implementar `packages/languages/python` con `web-tree-sitter` + `tree-sitter-python`
      (`.wasm` prebuilt). Confirma que `LanguageAdapter` no quedó acoplado a JS/TS: en
      Python los docstrings son literales de string (no nodos `comment`), así que no
      hizo falta ninguna lógica extra para dejarlos intactos.
- [x] 10 fixtures de `tests/fixtures/python/*` (mismos casos que TypeScript, adaptados
      a sintaxis Python) pasan con la misma prueba de invariancia estructural. El test
      runner (`tests/cleaner.test.ts`) quedó parametrizado por lenguaje para no duplicar
      lógica de prueba. Total: 24 tests en verde (`npm test`).
- [x] Implementar modo live (`packages/vscode/src/liveWatcher.ts`): escucha
      `onDidChangeTextDocument` con debounce de 600ms, corre el motor real
      (`clean()`) sobre el documento completo, y muestra una sugerencia CodeLens
      ("💡 Comentario redundante — Eliminar") por cada comentario que el core marcó,
      reutilizando exactamente los mismos rangos de edición del core (no reimplementa
      el borrado). Con `aiCodeCleaner.liveMode.autoApply` activado, aplica sin
      preguntar; por defecto (`false`) solo sugiere. `aiCodeCleaner.liveMode.enabled`
      (default `true`) apaga todo el watcher si se desactiva.
- [x] `Clean Selection`: corre el motor sobre el archivo completo (por contexto/seguridad
      de parseo) pero solo aplica las ediciones que caen dentro de la selección actual.
- [x] `Restore`: `packages/vscode/src/backupStore.ts` guarda un backup de un solo nivel
      justo antes de cada `WorkspaceEdit` que la extensión aplica (comando manual,
      selección, o modo live con `autoApply`/sugerencia individual); `Restore` revierte
      a ese backup. Complementa el Ctrl+Z nativo, no lo reemplaza.
- [ ] Extensión VS Code aún no probada visualmente por un humano (ver nota de
      `test:e2e` arriba) — pendiente de que el usuario la pruebe con F5.

## FASE 5 — CLI ✅

- [x] `packages/registry`: nuevo paquete que centraliza qué `LanguageAdapter` usar por
      extensión (antes vivía duplicado en `packages/vscode/src/adapters.ts`). Ahora
      tanto la extensión de VS Code como la CLI dependen de este único registro —
      se creó justo cuando hubo un segundo consumidor real, no antes.
- [x] `packages/cli/src/cli.ts`: CLI mínima sin dependencias nuevas más allá de node
      built-ins. `ai-code-cleaner <archivos...>` en modo dry-run reporta cuántos
      comentarios de ruido hay por archivo; `--write` aplica los cambios; `--check`
      no toca nada y termina con código 1 si algún archivo cambiaría (pensado para CI).
      Reutiliza `clean()` de `@ai-code-cleaner/core` tal cual — cero lógica de limpieza
      duplicada respecto a la extensión de VS Code.
- [x] Probada manualmente de verdad (no solo compilación): corrida en modo dry-run,
      `--check` (exit code 1 con cambios pendientes, exit 0 sin ellos) y `--write`
      sobre una copia de uno de los fixtures, verificando el contenido resultante
      byte a byte contra lo esperado.
- [x] `npm test` (24 tests), `typecheck`, `build`, `lint` en verde con los paquetes
      nuevos incluidos.

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

## FASE 4 — Validación

- [x] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` en verde.
- [ ] Prueba manual en VS Code real con archivos reales generados por un agente de IA
      (pendiente de que el usuario la haga — ver nota de `test:e2e`).
