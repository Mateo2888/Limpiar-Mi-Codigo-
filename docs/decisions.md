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

## 6. Modo automático ("live watcher") por defecto sugiere, no borra en silencio

Ver `PROGRESS.md`/`CLAUDE.md`. Decisión de UX: `aiCodeCleaner.liveMode.enabled` por
defecto activo pero solo muestra una sugerencia (CodeLens/lightbulb) sobre el comentario
recién escrito; `aiCodeCleaner.liveMode.autoApply` (borrado inmediato sin intervención)
queda apagado por defecto. Motivo: evitar sorpresas la primera vez que alguien instala la
extensión, mientras se gana confianza en la heurística. Es reversible por configuración,
no una limitación técnica.
