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
- [x] **Empaquetado `.vsix` funcional** (`packages/vscode/scripts/{prepare-runtime,
      finalize-vsix}.mjs`, `npm run package`): bundle único con esbuild
      (`core`/`registry`/`lang-typescript`/`lang-python` embebidos), `web-tree-sitter`
      vendorizado aparte (usa `import.meta.url` internamente, no sobrevive el bundling
      a CJS), gramáticas `.wasm` vendorizadas en `dist/wasm/`, y un paso final que
      inyecta `node_modules/web-tree-sitter` en el `.vsix` con `zip` porque `vsce
      package` sin `--no-dependencies` arrastra el monorepo entero por los symlinks de
      npm workspaces (y con `--no-dependencies` descarta node_modules por completo).
      Tres problemas reales encadenados, documentados en `docs/decisions.md` §11.
      **Verificado de extremo a extremo**: el `.vsix` se extrajo en un directorio
      totalmente aislado del monorepo (sin ningún `node_modules` propio) y se activó
      con un stub mínimo de `vscode`, confirmando que el parseo WASM real, la
      detección de ruido y el `WorkspaceEdit` funcionan igual que en desarrollo — no
      solo que el paquete compile.
- [x] Ícono generado (`packages/vscode/icon.png`, 128×128, vía SVG propio + `@resvg/resvg-js`
      como herramienta de una sola vez, no dependencia permanente del repo).

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

## FASE 6 — Compatibilidad ampliada (en progreso)

Punto de partida: la herramienta solo cubría un editor (VS Code) y dos lenguajes
(TS/JS, Python). Investigación de qué hace falta para "cualquier lenguaje, cualquier
editor" documentada en `docs/decisions.md` §12.

- [x] **CLI: `--json`** — reporte estructurado por archivo (`status`, `noiseCount`,
      `applied`, `error`) en vez de solo texto humano, para integraciones automatizadas.
- [x] **CLI: `--stdin` / `--stdin-filepath`** — modo formatter estándar (mismo patrón
      que Prettier/Black): lee de stdin, escribe el resultado en stdout sin nada más
      (diagnósticos a stderr), pasa la entrada sin tocar ante cualquier duda. Permite
      integrarlo como formatter externo en Neovim (`conform.nvim`/`none-ls`), JetBrains
      (External Tools/File Watchers), Sublime, o cualquier editor con ese mecanismo
      genérico — sin escribir un plugin nativo por editor. Recetas concretas en
      `packages/cli/README.md`.
- [x] Probado manualmente de verdad (no solo compilación): `--json` con archivo
      soportado + no soportado (status y exit code correctos), `--check --json`,
      `--stdin` con TS y Python reales (stdout coincide byte a byte con lo esperado,
      stderr queda vacío en el camino feliz), y passthrough sin tocar ante un archivo
      con error de sintaxis.
- [x] **Cuarto lenguaje: Go** (`packages/languages/go`, `tree-sitter-go`, mismo patrón
      que TS/Python). Reveló un matiz real: en Go los doc comments (godoc) son
      comentarios de **línea** (`// FuncName hace X`), no de bloque como JSDoc en TS —
      sin ajuste, la heurística de ruido podría borrar documentación real de una
      función exportada. Resuelto en el propio adaptador (detecta cuando un comentario
      de línea encadena, sin saltos en blanco, hasta un `func`/`type`/`const`/`var`/
      `package`, y lo marca `isBlock: true` para que el core lo excluya siempre — sin
      tocar `core`). Documentado en `docs/decisions.md` §14.
- [x] 11 fixtures de `tests/fixtures/go/*` (los 10 casos habituales + uno nuevo,
      `11-godoc-preserved`, que prueba explícitamente que un doc comment con verbo
      disparador y pocas palabras sigue sin tocarse). Registrado en `@ai-code-cleaner/registry`
      (extensión `.go`) y vendorizado su `.wasm` en el `.vsix` de VS Code.
      Total: 37 tests en verde (`npm test`).
- [x] Probado manualmente de verdad en los tres frentes: CLI (`--json`, `--write`,
      `--stdin`) sobre archivos `.go` reales, y el `.vsix` empaquetado extraído en un
      directorio aislado del monorepo, activado con un stub de `vscode`, limpiando un
      archivo Go real de punta a punta (no solo que compile).
- [x] Se evaluó integrar Knip (detector de código/exports sin uso) para este objetivo
      y se descartó: resuelve un problema distinto (código muerto, no comentarios de
      ruido), es solo JS/TS, y choca con la filosofía "no mejores mi código". Ver
      `docs/decisions.md` §13.
- [x] **Cuarto lenguaje: Java** (`packages/languages/java`, `tree-sitter-java`).
      Confirmó la lección de Go: Javadoc es un comentario de **bloque** (`/** */`),
      así que no necesitó la lógica especial de detección de cadena de comentarios
      de Go — le basta la regla genérica del core. Reveló un matiz distinto:
      `tree-sitter-java` usa dos tipos de nodo de comentario separados
      (`line_comment`/`block_comment`) en vez de un único tipo `comment` como los
      demás lenguajes — el adaptador usa `isBlock: node.type === 'block_comment'`
      en vez del truco de texto de los otros adaptadores. Documentado en
      `docs/decisions.md` §15.
- [x] 11 fixtures de `tests/fixtures/java/*` (los 10 casos habituales + un
      `11-javadoc-preserved` análogo al de Go). Registrado en el registry
      (extensión `.java`) y vendorizado su `.wasm` en el `.vsix`. Total: 50 tests
      en verde (`npm test`).
- [x] Probado manualmente de verdad en los tres frentes (CLI `--json`/`--write`/
      `--stdin`, y el `.vsix` empaquetado extraído en un directorio aislado del
      monorepo) sobre archivos `.java` reales, igual que con Go.
- [x] **Quinto lenguaje: C#** (`packages/languages/csharp`, `tree-sitter-c-sharp`).
      Mismo matiz que Go, no el de Java: su doc comment idiomático (`/// <summary>`)
      es de línea, así que reutiliza el mecanismo de cadena-hasta-declaración de
      `lang-go` (con los tipos de declaración de C#). Detalle de empaquetado propio:
      el paquete npm (`tree-sitter-c-sharp`) y su `.wasm`
      (`tree-sitter-c_sharp.wasm`, con guion bajo) tienen nombres distintos.
      Documentado en `docs/decisions.md` §16.
- [x] 11 fixtures de `tests/fixtures/csharp/*` (los 10 habituales + un
      `11-xmldoc-preserved`). Registrado en el registry (extensión `.cs`) y
      vendorizado su `.wasm` en el `.vsix`. Total: 63 tests en verde (`npm test`).
- [x] Probado manualmente de verdad en los tres frentes (CLI, `.vsix` empaquetado)
      sobre archivos `.cs` reales, igual que con Go/Java.
- [x] **CLI: recorrido de directorios** (`expandTargets`/`collectSupportedFiles`,
      sin dependencia nueva): un argumento que es una carpeta se recorre
      recursivamente buscando extensiones soportadas, saltando `node_modules`,
      `.git`, `dist`, `build`, `target`, `bin`, `obj`, `vendor`, entornos
      virtuales, cachés de IDE, etc. por defecto (ampliable con `--ignore
      <nombre>`). `ai-code-cleaner .` ahora limpia un proyecto entero de una sola
      vez. Probado de verdad con un proyecto simulado de 5 lenguajes +
      `node_modules`/`dist` con ruido: los 5 archivos reales se limpiaron
      correctamente y `node_modules`/`dist` quedaron intactos.
- [x] **VS Code: comando `Clean Workspace`** — analiza todo el proyecto abierto
      (`vscode.workspace.findFiles`, respeta `.gitignore`/exclusiones del usuario),
      muestra un resumen (N comentarios en M archivos) y aplica todo con un único
      `WorkspaceEdit` multi-archivo (una sola operación atómica, un solo Ctrl+Z
      para el lote completo); revalida cada archivo contra lo analizado antes de
      aplicar y descarta los que cambiaron mientras tanto. Este es el flujo
      pedido explícitamente: "instalar sobre un proyecto ya avanzado y que lo
      analice y deje limpio". Verificado de extremo a extremo contra el `.vsix`
      real con un proyecto simulado de 3 archivos (2 con ruido, 1 limpio) en 3
      lenguajes distintos. Documentado en `docs/decisions.md` §17.
- [ ] Plugin nativo de JetBrains/Neovim: evaluado y pospuesto — ver justificación en
      `docs/decisions.md` §12 (SDK completamente distinto, no reutiliza este código;
      la ruta CLI ya cubre la mayoría de editores).
- [x] **Ajuste de precisión de la heurística** (`packages/core/src/rules/redundancy.ts`),
      motivado por investigación de comunidad (se descartaron las citas/estadísticas
      no verificables del reporte y se actuó solo sobre lo confirmado con ejecución
      directa): se agregaron marcadores estándar (`TODO`/`FIXME`/`XXX`/`WIP`/
      `deprecated`/directivas de linter) a `EXCLUSION_SUBSTRINGS` — antes se borraban
      si el texto contenía un verbo disparador, un bug real confirmado con
      `isNoiseLineComment('// TODO: validate this later') === true`; y se amplió
      `TRIGGER_WORDS` con verbos comunes que faltaban (`get/gets`, `set/sets`,
      `handle/handles`, `fetch`, `parse`, `build`, `generate`, `calculate`, `format`,
      `convert`, `filter`, `define`, `log`, `render`, `run`, `execute`, `register`, y
      sus equivalentes en español). Nuevo fixture `12-marker-preserved` en
      TypeScript y Python (63 → 65 tests en verde). Documentado en
      `docs/decisions.md` §18, incluyendo lo que se evaluó y se decidió NO
      implementar (overlap semántico código/comentario, densidad de comentarios por
      archivo, más idiomas sin caso concreto que lo motive).

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
