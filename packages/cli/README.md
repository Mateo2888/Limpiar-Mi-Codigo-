# @ai-code-cleaner/cli

CLI mínima sobre el mismo core que usa la extensión de VS Code — cero lógica de
limpieza duplicada, solo lectura/escritura de archivos y parseo de flags.

```bash
node packages/cli/dist/cli.js archivo.ts                # dry-run: reporta qué se eliminaría
node packages/cli/dist/cli.js archivo.ts otro.py --write # aplica los cambios
node packages/cli/dist/cli.js **/*.ts --check            # exit 1 si algo cambiaría (CI)
node packages/cli/dist/cli.js **/*.ts --check --json     # igual, pero reporte JSON
```

Soporta las mismas extensiones que la extensión de VS Code (ver
`@ai-code-cleaner/registry`): `.ts/.tsx/.mts/.cts/.js/.jsx/.mjs/.cjs/.py/.pyi`.

## `--json`

En vez de líneas de texto, imprime un array JSON (uno por archivo) a stdout:

```json
[
  { "file": "a.ts", "status": "changed", "noiseCount": 2, "applied": false, "error": null }
]
```

`status` es uno de `changed | unchanged | abstained | unsupported | error`. Pensado
para que otras herramientas/editores lean el resultado sin parsear texto humano.

## `--stdin` (modo formatter, para integrarlo en cualquier editor)

```bash
cat archivo.ts | node packages/cli/dist/cli.js --stdin --stdin-filepath archivo.ts
```

Lee el código completo de stdin y escribe el resultado limpio en stdout. **stdout
nunca lleva nada más que el código** (ni logs ni JSON) — cualquier diagnóstico va a
stderr — porque este modo está pensado para conectarse como "formatter externo" en
editores que no son VS Code, exactamente como se conecta Prettier/Black en esos mismos
flujos. `--stdin-filepath` decide el lenguaje por extensión; no necesita ser una ruta
real. Ante duda (error de sintaxis, extensión no soportada) devuelve la entrada
**sin tocar**, para que sea siempre seguro encadenarlo sin riesgo de vaciar el buffer.

### Recetas de integración

**Neovim** (con [conform.nvim](https://github.com/stevearc/conform.nvim)):

```lua
require('conform').setup({
  formatters_by_ft = {
    typescript = { 'ai-code-cleaner' },
    python = { 'ai-code-cleaner' },
  },
  formatters = {
    ['ai-code-cleaner'] = {
      command = 'node',
      args = { '/ruta/a/packages/cli/dist/cli.js', '--stdin', '--stdin-filepath', '$FILENAME' },
      stdin = true,
    },
  },
})
```

**JetBrains (IntelliJ/WebStorm/PyCharm)**: `Settings → Tools → External Tools`, nueva
herramienta con Program `node`, Arguments
`/ruta/a/packages/cli/dist/cli.js $FilePath$ --write`, Working directory `$ProjectFileDir$`.
(También se puede usar `File Watchers` para correrlo automáticamente al guardar.)

**Sublime Text**: un build system o un comando de `subprocess` que llame al mismo
binario con `--stdin --stdin-filepath` y reemplace el contenido del view con la salida.

**CI (cualquiera)**: `node packages/cli/dist/cli.js "**/*.ts" "**/*.py" --check --json`
— exit code 1 si algo cambiaría, reporte JSON para publicarlo como comentario o artefacto.

## Estado del diff

No tiene diff bonito (solo cuenta cuántos comentarios detectó por archivo) — para
inspeccionar exactamente qué se eliminaría antes de aplicar, usar `Preview Changes`
en la extensión de VS Code, o correr sin `--write` y revisar el resultado con
`git diff` después de un `--write` (el archivo original queda recuperable vía Git).
