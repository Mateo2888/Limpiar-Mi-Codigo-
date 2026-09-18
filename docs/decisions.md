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

## 12. Compatibilidad con otros editores vía CLI (`--json`, `--stdin`), no plugins nativos

Investigado antes de decidir: para "funcionar en cualquier editor" había dos caminos —
escribir un plugin nativo por editor (JetBrains/IntelliJ SDK en Kotlin, plugin de
Neovim en Lua, etc.), o exponer el motor de forma que los mecanismos genéricos de
"formatter/herramienta externa" que esos editores YA tienen puedan invocarlo. Se
eligió lo segundo:

- **`--json`**: reporte estructurado (`status`, `noiseCount`, `applied`, `error` por
  archivo) para que cualquier integración lea el resultado sin parsear texto humano.
- **`--stdin` / `--stdin-filepath`**: modo formatter estándar (mismo patrón que
  Prettier/Black/ESLint `--stdin`) — lee código de stdin, escribe el resultado en
  stdout, nada más en stdout (diagnósticos a stderr). Esto es exactamente lo que
  esperan `conform.nvim`/`none-ls` (Neovim), `External Tools`/`File Watchers`
  (JetBrains), o un build system de Sublime — ya saben conectar "un binario que lee
  stdin y escribe stdout" sin que este proyecto tenga que integrarse con la API
  específica de cada editor.
- Ante duda en modo `--stdin` (error de sintaxis, extensión no soportada) se devuelve
  la entrada **sin modificar**: un formatter externo tiene que ser siempre seguro de
  encadenar, nunca puede arriesgarse a vaciar o corromper el buffer del editor —
  coherente con "ante la duda, conservar".

**Por qué no plugins nativos (todavía):** JetBrains usa un SDK completamente distinto
(Kotlin/Java, IntelliJ Platform) que no reutiliza nada de este código TypeScript; un
plugin de Neovim nativo (Lua) tampoco. Ambos son proyectos aparte, no una extensión
natural del `core` actual. La ruta CLI cubre el 90% del valor (cualquier editor con
soporte de "formatter externo", que son casi todos) sin ese costo. Reconsiderar un
plugin nativo solo si la fricción de configurar la integración vía CLI resulta ser
un obstáculo real para usuarios de un editor específico.

## 13. Se evaluó y descartó Knip para "más lenguajes"

Se preguntó si `Knip` (ISC, licencia permisiva) podía servir para este objetivo.
Investigado y descartado: Knip detecta **archivos, dependencias y exports sin uso**
para que el usuario los borre — un problema de "código muerto", no de "comentarios
de ruido de IA". Además es JS/TS únicamente (más estrecho que este proyecto, no más
amplio) y su propósito (sugerir refactors/borrados) choca directo con la filosofía
no negociable de este proyecto ("NO MEJORES MI CÓDIGO. SOLO QUÍTALE EL RUIDO."). No
se integra.

## 14. Tercer lenguaje: Go, mismo patrón, con un matiz real de Go resuelto en el adaptador

`packages/languages/go` sigue exactamente el patrón de `lang-typescript`/`lang-python`
(`web-tree-sitter` + `tree-sitter-go`, `.wasm` prebuilt, `wasmDir` opcional). Un
segundo lenguaje ya había validado que `LanguageAdapter` no estaba acoplado a JS/TS;
Go valida algo distinto: **el patrón de exclusión "los bloques siempre se preservan"
no alcanza para todos los lenguajes.**

En Go, la convención de documentación (godoc) es un comentario de **línea** (`//`)
inmediatamente arriba de una declaración (`func`/`type`/`const`/`var`/`package`), sin
línea en blanco entre medio — a diferencia de JSDoc en TS, que es un comentario de
**bloque** (`/** */`) y ya queda excluido por la regla genérica. Sin ajuste, la
heurística de ruido podría borrar la documentación de una función exportada solo
porque empieza con un verbo disparador (ej. `// GetUser retorna el usuario...`).

**Solución, sin tocar `core`:** el adaptador de Go inspecciona el árbol — si un
comentario de línea encadena (sin saltos de línea en blanco, incluso a través de
varias líneas `//` consecutivas) hasta una declaración de ese tipo, se marca como
`isBlock: true` en el `CommentNode`. El core ya excluye siempre los bloques de su
heurística de ruido, así que esto reutiliza exactamente ese mecanismo — una
reinterpretación deliberada de `isBlock` como "esto ya está clasificado como
documentación, no evalúes la heurística de texto", no solo "empieza con `/*`".
Cubierto por el fixture `tests/fixtures/go/11-godoc-preserved`, que prueba
explícitamente que un doc comment con un verbo disparador y pocas palabras sigue
sin tocarse.

**Implicación para el próximo lenguaje:** antes de agregar uno nuevo, revisar cómo
documenta idiomáticamente ese lenguaje (¿bloque como JSDoc, o línea como godoc?) en
vez de asumir que el patrón de TS/Python generaliza.

## 15. Cuarto lenguaje: Java — mismo patrón, sin necesitar la lógica especial de Go

Siguiendo la implicación del punto anterior, antes de escribir código se revisó cómo
documenta Java: Javadoc (`/** ... */`) es un comentario de **bloque**, igual que
JSDoc en TS — a diferencia de godoc en Go. Confirmado: Java **no** necesita la
lógica de "detectar cadena de comentarios de línea hasta una declaración" que sí
hizo falta en `lang-go`; le basta con la regla genérica del core ("los bloques se
preservan siempre").

Sí apareció un matiz distinto, específico de la gramática: `tree-sitter-java` no usa
un único tipo de nodo `comment` (como JS/TS/Python/Go) — usa dos tipos separados,
`line_comment` y `block_comment`. El adaptador de Java (`packages/languages/java`)
detecta ambos tipos explícitamente y usa `isBlock: node.type === 'block_comment'`
en vez del truco de texto (`text.startsWith('/*')`) que usan los demás adaptadores.

Cubierto por `tests/fixtures/java/11-javadoc-preserved` (mismo propósito que el
`11-godoc-preserved` de Go: un Javadoc con verbo disparador y pocas palabras que
debe sobrevivir). 50 tests en verde en total. Verificado de extremo a extremo con
CLI (`--json`/`--write`/`--stdin`) y el `.vsix` empaquetado, extraído en un
directorio aislado y ejecutado contra un archivo `.java` real.

**Implicación reforzada:** cada gramática tree-sitter puede nombrar sus nodos de
comentario distinto — revisar el `grammar.js`/`node-types.json` del paquete real
antes de asumir que existe un solo tipo `comment`, no solo cómo documenta el lenguaje.

## 16. Quinto lenguaje: C# — mismo matiz que Go, no el de Java

`tree-sitter-c-sharp` usa un único tipo de nodo `comment` (como JS/TS/Python/Go, no
como Java). Pero su doc comment idiomático (XML doc, `/// <summary>...`) es un
comentario de **línea** — la propia gramática ni distingue `///` de `//` como
tokens separados, igual que en Go. `packages/languages/csharp` reutiliza el mismo
mecanismo de `lang-go` (cadena de comentarios de línea sin salto en blanco hasta una
declaración), con el conjunto de tipos de declaración de C# (`class_declaration`,
`method_declaration`, `property_declaration`, `field_declaration`, etc.).

Detalle de empaquetado: el paquete npm se llama `tree-sitter-c-sharp` (con guiones)
pero el `.wasm` que publica se llama `tree-sitter-c_sharp.wasm` (con guion bajo) —
nombres distintos, hay que resolverlos por separado en vez de derivar uno del otro
(`packages/languages/csharp/src/index.ts`, `packages/vscode/scripts/prepare-runtime.mjs`).

Cubierto por `tests/fixtures/csharp/11-xmldoc-preserved`. 63 tests en verde en
total. Verificado de extremo a extremo (CLI + `.vsix` empaquetado y extraído en un
directorio aislado) contra un archivo `.cs` real.

Con TS/JS, Python, Go, Java y C# cubiertos, el patrón para agregar un lenguaje
nuevo está bien establecido: (1) confirmar que el paquete npm de la gramática
publica un `.wasm` prebuilt; (2) revisar su `grammar.js` para el/los tipo(s) de
nodo de comentario reales; (3) revisar si el doc comment idiomático del lenguaje es
de bloque (reutiliza la regla del core sin cambios, como Java) o de línea (necesita
el mecanismo de cadena-hasta-declaración de `lang-go`/`lang-csharp`, con los tipos
de declaración propios del lenguaje).

## 17. La CLI recorre directorios y la extensión limpia el workspace completo

Necesidad real señalada por el usuario: instalar la herramienta sobre un proyecto
ya existente (típicamente con mucho código generado por IA) y que la analice y
limpie de una sola vez, no archivo por archivo.

**CLI:** un argumento que es un directorio ahora se recorre recursivamente
(`expandTargets`/`collectSupportedFiles` en `packages/cli/src/cli.ts`), filtrando
por las extensiones que el `registry` soporta y saltando una lista de carpetas
ignoradas por defecto (`node_modules`, `.git`, `dist`, `build`, `target`, `bin`,
`obj`, `vendor`, entornos virtuales de Python, cachés de IDE, etc.), ampliable con
`--ignore <nombre>` repetible. Se implementó con un recorrido de directorios propio
(sin dependencia nueva) en vez de una librería de globbing — no hacía falta
sintaxis de glob arbitraria, solo "todo archivo soportado bajo esta carpeta".
`ai-code-cleaner .` limpia (o reporta, con `--check`/`--json`) un proyecto entero.

**Extensión de VS Code:** comando nuevo `AI Code Cleaner: Clean Workspace`. Usa
`vscode.workspace.findFiles` (que ya respeta `.gitignore` y las exclusiones de
búsqueda configuradas por el usuario, sin reinventar esa lógica) más una exclusión
explícita de `node_modules`. Analiza todos los archivos encontrados con una barra
de progreso cancelable, muestra un resumen ("N comentarios en M archivos") en vez
de abrir un diff por archivo (inmanejable en un proyecto grande), y si el usuario
confirma, aplica todo con un único `WorkspaceEdit` multi-archivo — una sola
operación atómica, un solo Ctrl+Z para deshacer el lote completo. Antes de
aplicar, vuelve a comparar cada archivo contra el texto analizado y descarta del
lote cualquiera que haya cambiado mientras tanto (mismo principio de seguridad que
`Clean Current File`, adaptado a múltiples archivos).

Verificado de extremo a extremo contra el `.vsix` real empaquetado: un stub de
`vscode` que simula `findFiles` devolviendo 3 archivos (TS, Python, Go) — dos con
ruido, uno ya limpio — confirmó que el comando detecta los 2 correctos, deja el
tercero fuera del lote, y aplica un único `WorkspaceEdit` con el contenido esperado
para cada archivo.

## 18. Ajuste de precisión en la heurística: marcadores estándar + verbos faltantes

El usuario pidió investigar en la comunidad (repos/foros) qué se podría mejorar
para que la herramienta sea más precisa. Se lanzó un subagente de investigación de
fondo; su reporte se trató como dato no confiable por defecto (varias citas —un
paper de arxiv con ID específico, una URL de issue de GitHub, estadísticas de un
blog fechado en 2026 con precisión sospechosa— tenían pinta de alucinadas y no se
verificaron ni se usaron como base de nada). En vez de aceptar el reporte al pie
de la letra, se usó solo como disparador para probar el comportamiento real del
motor con casos concretos (`isNoiseLineComment` en
`packages/core/src/rules/redundancy.ts`), y esa prueba directa sí encontró dos
problemas genuinos:

1. **Falso positivo confirmado (bug real):** `// TODO: validate this later` y
   `// FIXME: check this` se borraban, porque `EXCLUSION_SUBSTRINGS` no tenía
   ninguna entrada para marcadores estándar de la comunidad. Un `TODO`/`FIXME`/
   directiva de linter (`eslint-disable`, `ts-ignore`, `ts-expect-error`, `noqa`,
   `nolint`, `pragma`, etc.) nunca debe borrarse por su contenido — es información
   de estado del código, no ruido paráfrasis. Se agregaron esas cadenas a
   `EXCLUSION_SUBSTRINGS`.
2. **Vacío de recall (no un bug, una lista incompleta):** `// Gets the user` no se
   detectaba como ruido porque `get`/`set`/`handle`/`fetch`/`parse`/`build`/etc. no
   estaban en `TRIGGER_WORDS`, a pesar de ser verbos tan comunes en comentarios
   generados por IA como `verify`/`check`/`return`. Se amplió la lista con verbos
   equivalentes en inglés y español (ver el archivo fuente para el listado
   completo).

Ambos cambios se verificaron primero con ejecución directa (`isNoiseLineComment`
llamado a mano contra los casos concretos) antes de tocar fixtures, y luego se
agregó el caso `12-marker-preserved` a los fixtures de TypeScript y Python (el
único paquete que cambió fue `core`, así que alcanza con demostrarlo en dos
lenguajes, no en los cinco) — sube de 63 a 65 tests en verde.

**Deliberadamente NO se implementó** nada del resto de lo que trajo el reporte del
subagente, en todos los casos por la misma razón: no había evidencia verificable
de que resolviera un problema real, o entraba en conflicto directo con una
decisión ya tomada:

- **Comparación semántica comentario↔código siguiente (overlap de tokens/
  identificadores):** ya rechazada en §6 — el comentario suele estar en español y
  el código en inglés (o viceversa), así que un match de tokens produciría falsos
  negativos constantes, justo lo opuesto a "más preciso".
- **Heurística de densidad de comentarios por archivo** (marcar como sospechoso un
  archivo con "demasiados" comentarios cortos): se descartó por ser una señal de
  archivo completo, no de comentario individual — viola la filosofía de "ante la
  duda, se conserva" a nivel de línea, y un archivo legítimamente bien comentado
  (ej. código educativo) no debería activar ningún comportamiento especial.
- **Listas de verbos disparadores en portugués/francés/alemán:** ningún caso real
  concreto lo pedía todavía (a diferencia de TODO/FIXME y get/set, que se
  confirmaron con ejecución directa); agregar idiomas sin un caso que lo motive es
  extender superficie de falsos positivos/negativos a ciegas. Queda como
  ampliación futura si aparece una necesidad concreta, no especulativa.
