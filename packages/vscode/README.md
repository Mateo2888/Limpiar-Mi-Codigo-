# ai-code-cleaner-vscode

Implementado (FASE 3):

- `src/extension.ts`: activación, comandos `AI Code Cleaner: Clean Current File` y
  `AI Code Cleaner: Preview Changes`. Ambos corren el motor real (`@ai-code-cleaner/core`
  + `@ai-code-cleaner/lang-typescript`) sobre el archivo activo y muestran el resultado
  con el diff nativo de VS Code (`vscode.diff` contra un documento virtual de solo
  lectura). `Clean Current File` además ofrece aplicar/descartar; si aplica, usa
  `WorkspaceEdit` (deshacer con Ctrl+Z) y aborta si el archivo cambió mientras se
  mostraba el diff.
- Modo live (watcher automático) y `Clean Selection`/`Restore`: **pendientes**, quedan
  para el siguiente incremento (ver `PROGRESS.md`).

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
