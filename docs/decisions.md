# Registro de decisiones técnicas

Formato corto: decisión, alternativas consideradas, por qué se descartaron.

## 1. Parser: tree-sitter (`web-tree-sitter`, WASM)

**Alternativas consideradas:**
- TypeScript Compiler API / Babel para JS-TS + `ast`/`tokenize`/LibCST para Python.
- Regex sobre el texto fuente.

**Por qué tree-sitter:**
- Conserva los nodos de comentario dentro del árbol (a diferencia de la mayoría de ASTs
  de compilador), que es justo lo que necesitamos: saber qué nodo de código sigue a
  cada comentario sin heurísticas de texto frágiles.
- `web-tree-sitter` usa WASM → no requiere compilar binarios nativos por SO/arquitectura,
  crítico para distribuir una extensión de VS Code sin binarios prebuilt.
- Gramáticas maduras y con licencia permisiva para JS/TS/TSX y Python.

**Por qué no compiler APIs propios por lenguaje:**
- Significa una integración completamente distinta por lenguaje desde el día 1
  (LibCST además requeriría runtime de Python embebido en una extensión Node).
  Más dependencias y más superficie de mantenimiento sin necesidad real: no hacemos
  análisis semántico profundo, solo ubicamos comentarios y su contexto sintáctico inmediato.

**Por qué no regex:**
- Falla exactamente en los casos que los propios requisitos de test señalan: `//` dentro
  de strings, URLs, comentarios dentro de strings. Un parser real evita esto sin esfuerzo extra.

## 2. No reutilizar el binario de `Goldziher/uncomment`

`uncomment` (Rust, tree-sitter, licencia MIT) es prior art real y válida, pero:
- Borra por **categoría** de comentario (TODO, docstring, pragma, etc.), no por
  "¿este comentario parafrasea la línea siguiente?" — no cubre el caso central de este
  proyecto.
- Es un binario Rust: usarlo implicaría empaquetar un binario nativo por plataforma dentro
  de la extensión, exactamente la complejidad que `web-tree-sitter` (WASM) nos permite evitar.

Se reimplementa el motor en TypeScript puro, sobre las mismas gramáticas tree-sitter
(mismo ecosistema, misma filosofía de "AST real, no regex", sin heredar la limitación
de categorías de `uncomment`).

## 3. Heurística de detección: reglas explícitas, no ML/IA

Ver `CLAUDE.md` para el detalle de la regla base ("paráfrasis de la línea siguiente") y
las exclusiones. Decisión: lista corta y auditable de patrones, ampliable por PR, en vez
de un clasificador estadístico o un LLM. Motivo: el requisito explícito del proyecto es
"determinista y local", y "si hay duda, conservar" — un modelo probabilístico no da esa
garantía de forma auditable.

## 4. Biome para lint + format del propio repo

**Alternativa considerada:** ESLint + Prettier.

**Por qué Biome:** una sola dependencia cubre ambos roles (lint y format), con soporte
nativo de TypeScript sin plugins adicionales. Menos superficie de dependencias que dos
herramientas separadas. Esto aplica solo al desarrollo del repo — el motor de limpieza
nunca reformatea el código del usuario final.

## 5. Sin husky para git hooks

**Alternativa considerada:** husky.

**Por qué no:** un script simple en `.githooks/pre-commit` + `git config core.hooksPath
.githooks` cubre la misma necesidad (correr lint/typecheck/test antes de commitear) sin
añadir una dependencia de npm solo para eso.

## 6. Heurística real de ruido: sin comparación contra la línea siguiente

**Diseñado en FASE 1, cambiado durante la implementación (FASE 3):** la idea original
era marcar como ruido un comentario cuyo contenido (quitando el verbo disparador) fuera
"subconjunto" de los identificadores de la línea de código siguiente. En la práctica
esto casi nunca matchea: el código suele usar identificadores en inglés
(`amountInCents`) mientras el comentario está en español (`"Validar el monto"`), o
viceversa. Ese chequeo producía falsos negativos sistemáticos, no falsos positivos, así
que técnicamente era "seguro" pero inútil — no detectaba casi nada.

**Regla final:** comentario de línea (`//`/`#`), de máximo 8 palabras, que contiene al
menos una palabra de una lista corta de verbos disparadores (ES/EN: verificar, validar,
procesar, devolver, retornar, crear, guardar, etc.) y **ninguna** palabra de una lista
de exclusión que indique razón/decisión/limitación/workaround. Sigue siendo determinista
y auditable (dos listas de palabras en `core/src/rules/redundancy.ts`), y sigue
respetando "ante la duda, conservar" — un comentario que no matchea ningún disparador
simplemente nunca se toca.

**Simplificación adicional:** solo comentarios de **línea** son candidatos. Los de
bloque (`/** */`, docstrings) siempre se conservan en v1 — evita tener que distinguir
JSDoc/docstring de un bloque "de relleno" (caso mucho más ambiguo) hasta que haya
evidencia real de que hace falta.

## 7. `LanguageAdapter` es async

Cargar una gramática de tree-sitter vía `web-tree-sitter` (`Language.load(wasmBytes)`)
es asíncrono (lectura + instanciación del módulo WASM), aunque se cachea por gramática
y solo ocurre una vez. Por eso `findComments`, `nextCodeNodeText` y `hasParseErrorNear`
en `core/src/types.ts` devuelven `Promise`, y `core.clean()` es `async`. Se decidió no
forzar una API síncrona con "warm-up" manual (se intentó y quedó frágil) — es más simple
y más difícil de usar mal si el contrato es async desde el principio.

## 8. Modo automático ("live watcher") por defecto sugiere, no borra en silencio

Ver `PROGRESS.md`/`CLAUDE.md`. Decisión de UX: `aiCodeCleaner.liveMode.enabled` por
defecto activo pero solo muestra una sugerencia (CodeLens/lightbulb) sobre el comentario
recién escrito; `aiCodeCleaner.liveMode.autoApply` (borrado inmediato sin intervención)
queda apagado por defecto. Motivo: evitar sorpresas la primera vez que alguien instala la
extensión, mientras se gana confianza en la heurística. Es reversible por configuración,
no una limitación técnica.

## 9. `packages/registry` se creó al aparecer un segundo consumidor real

La lógica de "qué `LanguageAdapter` usar según la extensión del archivo" vivió
primero solo en `packages/vscode/src/adapters.ts` (único consumidor en ese momento).
Al implementar `packages/cli`, que necesita exactamente la misma decisión, se movió
a un paquete nuevo (`@ai-code-cleaner/registry`) del que ambos dependen. No se creó
antes "por si acaso" — se esperó a tener un segundo caso de uso real para no
adivinar una abstracción que quizás no hiciera falta.

## 10. CLI mínima, sin dependencias de parseo de argumentos

`packages/cli/src/cli.ts` parsea `process.argv` a mano (un `for` con comparaciones de
string) en vez de usar `yargs`/`commander`. Con tres flags (`--write`, `--check`,
`--help`) una librería de parsing de argumentos no aporta nada que no sean unas
pocas líneas de más superficie de dependencias. Si la CLI crece (subcomandos, muchas
opciones), reconsiderar esta decisión — no antes.

## 11. Empaquetado del `.vsix`: bundle con esbuild + `web-tree-sitter` vendorizado aparte

Empaquetar una extensión de VS Code que vive en un monorepo npm workspaces con
dependencias WASM tiene dos problemas reales, no cosméticos:

**Problema 1 — el motor de limpieza no puede simplemente "ir sin cambios" al `.vsix`.**
Un `.vsix` instalado no tiene el `node_modules` del monorepo disponible; los `require`
a `@ai-code-cleaner/core`, `lang-typescript`, etc. (symlinks de npm workspaces) no
resolverían. Solución: `esbuild` empaqueta todo el código propio (`core`, `registry`,
`lang-typescript`, `lang-python`) en un único `dist/extension.js`, sin dependencias
externas salvo `vscode` (provisto por el host) y `web-tree-sitter` (ver problema 2).

**Problema 2 — `web-tree-sitter` no sobrevive el bundling a CJS.** Usa
`import.meta.url` internamente (para ubicar su propio `tree-sitter.wasm` y para el
glue code de Emscripten). Al bundlear a formato CJS, `import.meta.url` queda vacío
(advertencia explícita de esbuild) y el `Parser.init()` de la librería falla en
runtime. Se probó primero confiar en que esbuild inyectara un shim — no lo hace.
**Solución:** `web-tree-sitter` se marca `external` en esbuild (nunca se bundlea) y se
vendoriza tal cual (su carpeta real, sin tocar) dentro de `node_modules/` del paquete
de VS Code — usa su propio build CJS (`tree-sitter.cjs`, vía `"exports"."require"` en
su `package.json`), que sí usa `__dirname` real y no tiene el problema.

Como consecuencia, los adaptadores de lenguaje (`lang-typescript`, `lang-python`)
ahora aceptan un `wasmDir` opcional (`createTypeScriptAdapter(ext, wasmDir)`,
`createPythonAdapter(wasmDir)`, propagado por `@ai-code-cleaner/registry`): cuando se
pasa, las gramáticas `.wasm` se leen de esa carpeta (vendorizadas junto al bundle, ver
`packages/vscode/scripts/prepare-runtime.mjs`) en vez de resolverse vía
`require.resolve` del paquete npm real. La CLI y los tests no pasan `wasmDir` — siguen
usando la resolución normal contra el `node_modules` del monorepo, sin cambios.
También por esto, dentro de esos adaptadores el `createRequire(import.meta.url)`
propio (usado solo en la rama sin `wasmDir`) se volvió perezoso: si se evaluara a
nivel de módulo, rompería igual que `web-tree-sitter` al bundlear, aunque esa rama
nunca se ejecute en el bundle de VS Code.

**Problema 3 — `vsce package` arrastra el monorepo entero.** Sin `--no-dependencies`,
`vsce` sigue los symlinks de npm workspaces (incluso sin declarar
`@ai-code-cleaner/core`/`registry` en el `package.json` de la extensión) y termina
incluyendo paquetes hermanos completos, fallando además con una ruta relativa inválida
al toparse con archivos fuera de la carpeta de la extensión. `--no-dependencies` evita
esto — pero también excluye **todo** `node_modules`, incluido el `web-tree-sitter`
vendorizado que sí necesitamos. **Solución:** empaquetar con `--no-dependencies`
(limpio, sin fugas) y luego inyectar `node_modules/web-tree-sitter` directamente en el
`.vsix` con el binario `zip` (un `.vsix` es solo un `.zip`) — ver
`packages/vscode/scripts/finalize-vsix.mjs`.

Verificado de extremo a extremo (no solo compilación): el `.vsix` generado se extrajo
en un directorio aislado (fuera del monorepo, sin ningún `node_modules` propio) y se
activó/ejecutó con un stub mínimo del módulo `vscode`, confirmando que el parseo real
vía WASM, la detección de ruido y la aplicación del `WorkspaceEdit` funcionan
exactamente igual que en desarrollo.
