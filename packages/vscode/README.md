# ai-code-cleaner-vscode

Implementado (FASE 3), comandos disponibles desde la Command Palette:

- **`AI Code Cleaner: Clean Current File`** y **`... Preview Changes`**
  (`src/extension.ts`): corren el motor real (`@ai-code-cleaner/core` +
  `lang-typescript`/`lang-python`/`lang-go`/`lang-java`/`lang-csharp`) sobre el
  archivo activo y muestran el resultado con el diff nativo de VS Code
  (`vscode.diff` contra un documento virtual de solo lectura). `Clean Current File`
  además ofrece aplicar/descartar; si aplica, usa `WorkspaceEdit` (deshacer con
  Ctrl+Z) y aborta si el archivo cambió mientras se mostraba el diff.
- **`AI Code Cleaner: Clean Selection`**: igual que `Clean Current File`, pero solo
  aplica las ediciones que caen dentro del texto seleccionado (sigue analizando el
  archivo completo, por seguridad y contexto de parseo).
- **`AI Code Cleaner: Clean Workspace`**: analiza y limpia **todo el proyecto abierto**
  de una sola vez — el flujo pensado para instalar la extensión sobre un desarrollo
  ya avanzado hecho con IA. Usa `vscode.workspace.findFiles` (respeta `.gitignore` y
  las exclusiones configuradas por el usuario, más `node_modules` excluido siempre),
  analiza con una barra de progreso cancelable, muestra un resumen ("N comentarios en
  M archivos") en vez de un diff por archivo, y si se confirma, aplica todo con un
  único `WorkspaceEdit` multi-archivo — una sola operación atómica, un solo Ctrl+Z
  para deshacer el lote completo. Revalida cada archivo contra lo analizado antes de
  aplicar, para no pisar cambios hechos mientras se mostraba el resumen.
- **`AI Code Cleaner: Restore`**: deshace el último cambio aplicado por AI Code Cleaner
  en el archivo activo (`src/backupStore.ts` guarda un backup de un solo nivel justo
  antes de cada `WorkspaceEdit` que la propia extensión aplica, incluidos los de
  `Clean Workspace` por archivo). Complementa, no reemplaza, el Ctrl+Z nativo de VS Code.
- **Modo live** (`src/liveWatcher.ts`): sugiere vía CodeLens eliminar un comentario de
  ruido justo después de escribirlo (`aiCodeCleaner.liveMode.enabled`, default `true`);
  con `aiCodeCleaner.liveMode.autoApply` (default `false`) lo borra sin preguntar. También
  guarda backup antes de tocar nada, así que `Restore` funciona igual en este modo.

## Cómo probarlo manualmente

1. `npm install && npm run build` en la raíz del repo.
2. Abrir `packages/vscode` en VS Code y presionar F5 (Extension Development Host).
3. Abrir un archivo `.ts`/`.js`/`.py` con comentarios de relleno y correr desde la
   Command Palette `AI Code Cleaner: Preview Changes` o `AI Code Cleaner: Clean Current File`.

## Empaquetar un `.vsix` instalable

```bash
cd packages/vscode
npm run package   # genera dist/ai-code-cleaner.vsix
```

Luego, en VS Code: Command Palette → `Extensions: Install from VSIX...` → seleccionar
`packages/vscode/dist/ai-code-cleaner.vsix`.

`npm run package` hace tres cosas, en orden (ver `docs/decisions.md` §11 para el porqué
de cada una):
1. `npm run build`: compila + empaqueta con esbuild todo el código propio
   (`core`, `registry`, `lang-typescript`, `lang-python`, `lang-go`, `lang-java`,
   `lang-csharp`) en un único `dist/extension.js`, y vendoriza las gramáticas
   `.wasm` en `dist/wasm/` (`scripts/prepare-runtime.mjs`).
2. `vsce package --no-dependencies`: genera el `.vsix` sin que `vsce` intente seguir los
   symlinks del monorepo (si no, arrastra paquetes hermanos enteros y falla).
3. `scripts/finalize-vsix.mjs`: inyecta `node_modules/web-tree-sitter` (vendorizado sin
   bundlear, porque usa `import.meta.url` internamente) directamente en el `.vsix` con
   el binario `zip`, ya que `--no-dependencies` también excluye eso.

Verificado en esta sesión: el `.vsix` resultante se extrajo en un directorio aislado
(sin ningún `node_modules` propio, fuera del monorepo) y se activó/ejecutó con un stub
mínimo del módulo `vscode`, confirmando que el parseo real vía WASM, la detección de
comentarios de ruido y la aplicación del `WorkspaceEdit` funcionan igual que en
desarrollo — no solo que el paquete compile o que `vsce` no reviente.

## Test de integración end-to-end

`npm run test:e2e` (dentro de `packages/vscode`) usa `@vscode/test-electron` para abrir
un VS Code real headless, activar la extensión, correr `Preview Changes` sobre un
archivo con ruido de IA de verdad, y verificar que se abre la pestaña de diff. Necesita
descargar un binario de VS Code la primera vez — **no se pudo ejecutar dentro de esta
sesión de Claude Code** porque el proxy de salida del entorno bloquea
`update.code.visualstudio.com` por política de la organización; sí debería funcionar en
una máquina con acceso normal a internet.
