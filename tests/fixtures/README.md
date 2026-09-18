# Fixtures de test

Cada subcarpeta de `typescript/` (y, cuando exista, `python/`) es un caso de prueba con:

- `input.<ext>`: código de entrada, tal como lo dejaría un agente de IA.
- `expected.<ext>`: resultado esperado después de correr el cleaner. Para los casos donde
  no debe cambiar nada, `expected` es idéntico a `input`.

El test runner (a implementar en FASE 3, en `packages/core`) debe recorrer cada carpeta,
correr el cleaner sobre `input`, y:

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

La prueba de invariancia estructural (punto 2 arriba) se aplica a **todos** los casos,
no es una carpeta aparte — es la garantía transversal de que nunca se toca lógica.
