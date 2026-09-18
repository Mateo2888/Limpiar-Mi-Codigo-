# @ai-code-cleaner/lang-csharp

Usa `web-tree-sitter` + gramática `tree-sitter-c-sharp` (`.wasm` prebuilt —
ojo, el archivo se llama `tree-sitter-c_sharp.wasm` con guion bajo, nombre
distinto al del paquete npm).

**Mismo matiz que Go, no el de Java:** los comentarios de documentación XML de
C# (`/// <summary>...`) son comentarios de **línea**, no de bloque — la propia
gramática ni distingue `///` de `//` como tokens separados. Este adaptador
reutiliza el mecanismo de `lang-go` (detectar si un comentario de línea
encadena, sin saltos en blanco, hasta una declaración de clase/método/
propiedad/etc.) para protegerlos, con el conjunto de tipos de declaración de
C# en vez de los de Go.

Ver `tests/fixtures/csharp/*` para los casos de prueba, corridos por
`tests/cleaner.test.ts`.
