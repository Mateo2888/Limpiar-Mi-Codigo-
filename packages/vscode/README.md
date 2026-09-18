# ai-code-cleaner-vscode

Implementado (FASE 3), comandos disponibles desde la Command Palette:

- **`AI Code Cleaner: Clean Current File`** y **`... Preview Changes`**
  (`src/extension.ts`): corren el motor real (`@ai-code-cleaner/core` +
  `lang-typescript`/`lang-python`) sobre el archivo activo y muestran el resultado con
  el diff nativo de VS Code (`vscode.diff` contra un documento virtual de solo lectura).
  `Clean Current File` además ofrece aplicar/descartar; si aplica, usa `WorkspaceEdit`
  (deshacer con Ctrl+Z) y aborta si el archivo cambió mientras se mostraba el diff.
- **`AI Code Cleaner: Clean Selection`**: igual que `Clean Current File`, pero solo
  aplica las ediciones que caen dentro del texto seleccionado (sigue analizando el
  archivo completo, por seguridad y contexto de parseo).
- **`AI Code Cleaner: Restore`**: deshace el último cambio aplicado por AI Code Cleaner
  en el archivo activo (`src/backupStore.ts` guarda un backup de un solo nivel justo
  antes de cada `WorkspaceEdit` que la propia extensión aplica). Complementa, no
  reemplaza, el Ctrl+Z nativo de VS Code.
- **Modo live** (`src/liveWatcher.ts`): sugiere vía CodeLens eliminar un comentario de
  ruido justo después de escribirlo (`aiCodeCleaner.liveMode.enabled`, default `true`);
  con `aiCodeCleaner.liveMode.autoApply` (default `false`) lo borra sin preguntar. También
  guarda backup antes de tocar nada, así que `Restore` funciona igual en este modo.

## Cómo probarlo manualmente

1. `npm install && npm run build` en la raíz del repo.
2. Abrir `packages/vscode` en VS Code y presionar F5 (Extension Development Host).
3. Abrir un archivo `.ts`/`.js` con comentarios de relleno y correr desde la Command
   Palette `AI Code Cleaner: Preview Changes` o `AI Code Cleaner: Clean Current File`.

## Test de integración end-to-end

`npm run test:e2e` (dentro de `packages/vscode`) usa `@vscode/test-electron` para abrir
un VS Code real headless, activar la extensión, correr `Preview Changes` sobre un
archivo con ruido de IA de verdad, y verificar que se abre la pestaña de diff. Necesita
descargar un binario de VS Code la primera vez — **no se pudo ejecutar dentro de esta
sesión de Claude Code** porque el proxy de salida del entorno bloquea
`update.code.visualstudio.com` por política de la organización; sí debería funcionar en
una máquina con acceso normal a internet.
