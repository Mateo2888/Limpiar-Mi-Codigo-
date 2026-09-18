# Fixtures de test

Cada subcarpeta de `typescript/` (y, cuando exista, `python/`) es un caso de prueba con:

- `input.<ext>`: código de entrada, tal como lo dejaría un agente de IA.
- `expected.<ext>`: resultado esperado después de correr el cleaner. Para los casos donde
  no debe cambiar nada, `expected` es idéntico a `input`.

El test runner (`tests/cleaner.test.ts`) recorre cada carpeta, corre el cleaner real
sobre `input`, y:

1. Comparar el resultado byte a byte contra `expected`.
2. Prueba de invariancia estructural: parsear `input` y el resultado, quitar los nodos de
   comentario de ambos árboles, y verificar que los árboles restantes son idénticos en
   tipo/orden/rango de nodos de código. Si esto falla, el cambio tocó lógica, no solo
   comentarios — debe hacer fallar el test aunque el texto coincidiera con `expected`.
3. Verificar que el resultado sigue siendo sintácticamente válido (parsea sin errores).

## Casos cubiertos (TypeScript)

| Carpeta | Qué demuestra |
|---|---|
| `01-obvious-noise` | Comentario que parafrasea la línea siguiente → se elimina |
| `02-useful-comment` | Comentario que explica algo no evidente → se conserva |
| `03-business-decision` | Comentario que documenta una regla de negocio → se conserva |
| `04-workaround` | Comentario que explica un workaround/limitación externa → se conserva |
| `05-no-comments` | Código sin comentarios → permanece igual |
| `06-mixed-comments` | Varios comentarios, mezcla de ruido y útiles → solo se eliminan los que corresponde |
| `07-string-with-slashes` | Un string que contiene `//` no se confunde con un comentario |
| `08-url-in-code` | Una URL dentro del código no se modifica |
| `09-comment-inside-string` | Texto con forma de comentario dentro de un string no se toca |
| `10-parse-error-abstain` | Código con error de sintaxis → el cleaner no toca nada |

## Casos cubiertos (Python)

Los mismos 10 casos, adaptados a sintaxis Python (`#` en vez de `//`, sin
comentarios de bloque — los docstrings son literales de string, ni siquiera
llegan a evaluarse como comentarios). `07-hash-in-string` reemplaza a
`07-string-with-slashes` con el mismo propósito: un `#` dentro de un string no
debe confundirse con un comentario.

## Casos cubiertos (Go)

Los mismos 10 casos, adaptados a sintaxis Go, más uno adicional:

| Carpeta | Qué demuestra |
|---|---|
| `11-godoc-preserved` | Comentarios de documentación estilo godoc (`// FuncName hace X`, `//` inmediatamente arriba de un `func`/`type`/`var`, sin línea en blanco entre medio) se conservan **siempre**, aunque su texto matchee la heurística genérica de ruido. Ver `packages/languages/go/README.md`. |

Este caso existe porque en Go los doc comments son comentarios de **línea** (`//`), a
diferencia de JSDoc en TS (`/** */`, comentario de bloque) — sin una regla específica,
la heurística genérica podría borrar la documentación de una función exportada solo
porque su primera palabra coincide con un verbo disparador (ej. "GetUser **retorna**
el usuario...").

## Casos cubiertos (Java)

Los mismos 10 casos, adaptados a sintaxis Java, más uno adicional:

| Carpeta | Qué demuestra |
|---|---|
| `11-javadoc-preserved` | Javadoc (`/** ... */`) con verbo disparador y pocas palabras se conserva siempre, vía la regla genérica del core ("los bloques se preservan siempre") — Java no necesitó la lógica especial de Go porque su documentación sí es de bloque. Ver `packages/languages/java/README.md`. |

`tree-sitter-java` también tiene un matiz de gramática distinto: usa dos tipos de
nodo de comentario separados (`line_comment`/`block_comment`), no un único tipo
`comment` como los demás lenguajes.

## Casos cubiertos (C#)

Los mismos 10 casos, adaptados a sintaxis C#, más uno adicional:

| Carpeta | Qué demuestra |
|---|---|
| `11-xmldoc-preserved` | El doc comment XML de C# (`/// <summary>...`) con verbo disparador y pocas palabras se conserva siempre — igual matiz que Go (es un comentario de línea, no de bloque), a diferencia de Java. Ver `packages/languages/csharp/README.md`. |

La prueba de invariancia estructural (punto 2 arriba) se aplica a **todos** los casos,
en los cinco lenguajes — es la garantía transversal de que nunca se toca lógica.
