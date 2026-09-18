# @ai-code-cleaner/lang-go

Usa `web-tree-sitter` + gramática `tree-sitter-go` (`.wasm` prebuilt, sin
compilación nativa), mismo patrón que `lang-typescript`/`lang-python`.

**Matiz específico de Go:** a diferencia de JSDoc en TS (`/** */`, comentario de
bloque), los comentarios de documentación de Go (convención godoc:
`// FuncName hace X`, inmediatamente arriba de la declaración, sin línea en
blanco entre medio) son comentarios de **línea** (`//`). La regla genérica del
core ("solo los comentarios de bloque se preservan siempre") no los protegería
por sí sola. Este adaptador detecta ese patrón (comentario de línea que, sin
saltos en blanco, termina justo antes de un `func`/`type`/`const`/`var`/
`package`) y lo marca como `isBlock: true` para que el core lo excluya siempre
de la heurística de ruido — sin cambiar nada en `core`.

Ver `tests/fixtures/go/*` para los casos de prueba, corridos por
`tests/cleaner.test.ts`.
