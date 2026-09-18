# @ai-code-cleaner/lang-java

Usa `web-tree-sitter` + gramática `tree-sitter-java` (`.wasm` prebuilt, sin
compilación nativa), mismo patrón que `lang-typescript`/`lang-python`/`lang-go`.

**Diferencia respecto a los demás adaptadores:** `tree-sitter-java` no usa un
único tipo de nodo `comment` — distingue `line_comment` (`//`) de
`block_comment` (`/* */` y Javadoc `/** */`) como dos tipos de nodo separados.
Javadoc es siempre `block_comment`, así que ya queda protegido por la regla del
core ("los bloques se preservan siempre") sin necesitar la lógica adicional que
sí hizo falta en Go (donde los doc comments son de línea, no de bloque).

Ver `tests/fixtures/java/*` para los casos de prueba, corridos por
`tests/cleaner.test.ts`.
