# @ai-code-cleaner/lang-python

Implementado. Usa `web-tree-sitter` + gramática `tree-sitter-python` (`.wasm`
prebuilt, sin compilación nativa), igual que el adaptador de TypeScript.

Confirma que la interfaz `LanguageAdapter` (`@ai-code-cleaner/core`) no quedó
acoplada a JS/TS: en Python los docstrings son literales de string, no nodos de
`comment`, así que no hace falta ninguna lógica adicional para dejarlos intactos —
la única regla de exclusión que el adaptador necesita implementar es "esto es un
nodo `comment`", igual que en JS/TS.

Ver `tests/fixtures/python/*` para los 10 casos de prueba (mismos que TypeScript,
adaptados a sintaxis Python), corridos por `tests/cleaner.test.ts`.
