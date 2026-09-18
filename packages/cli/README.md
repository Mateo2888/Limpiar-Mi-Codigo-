# @ai-code-cleaner/cli

CLI mínima sobre el mismo core que usa la extensión de VS Code — cero lógica de
limpieza duplicada, solo lectura/escritura de archivos y parseo de flags.

```bash
node packages/cli/dist/cli.js archivo.ts                # dry-run: reporta qué se eliminaría
node packages/cli/dist/cli.js archivo.ts otro.py --write # aplica los cambios
node packages/cli/dist/cli.js **/*.ts --check            # exit 1 si algo cambiaría (CI)
```

Soporta las mismas extensiones que la extensión de VS Code (ver
`@ai-code-cleaner/registry`): `.ts/.tsx/.mts/.cts/.js/.jsx/.mjs/.cjs/.py/.pyi`.

No tiene diff bonito todavía (solo cuenta cuántos comentarios detectó por archivo) —
para inspeccionar exactamente qué se eliminaría antes de aplicar, usar `Preview
Changes` en la extensión de VS Code, o correr sin `--write` y revisar el resultado
con `git diff` después de un `--write` (el archivo original queda recuperable vía Git).
