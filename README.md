# AI Code Cleaner

Elimina los comentarios de relleno que dejan los agentes de IA (`// Verificar si el usuario existe`,
`// Devolver la respuesta`, etc.) sin tocar la lógica, los nombres ni el estilo de tu código.

> **NO MEJORES MI CÓDIGO. SOLO QUÍTALE EL RUIDO.**

Gratuito y de código abierto. Funciona 100% local — no envía tu código a ningún servicio
externo, no usa IA/LLM para decidir qué borrar (reglas deterministas), y siempre puedes
ver el diff y aceptar o rechazar antes de que se aplique un cambio.

## Estado

MVP funcional y empaquetable (ver `PROGRESS.md` para el detalle exacto por fase):
motor, extensión de VS Code (con `.vsix` instalable) y CLI ya funcionan, con pruebas
automatizadas en verde. Todavía no está publicada en el VS Code Marketplace ni en
npm — se instala generando el `.vsix`/ejecutando la CLI desde el código fuente (ver
abajo). Lo único que falta de confirmación humana: probar la extensión dentro de un
VS Code real (ver `packages/vscode/README.md`).

## Qué hace

- Detecta comentarios que solo parafrasean literalmente la línea de código siguiente
  (típico de agentes de IA) y los marca para eliminar.
- Conserva comentarios que explican una decisión de negocio, una limitación externa,
  un workaround, o cualquier cosa no evidente desde el código — ante la duda, conserva.
- Nunca cambia lógica, nombres, imports, tipos, condiciones ni formato.
- Comandos manuales en VS Code (`Clean Current File`, `Preview Changes`,
  `Clean Selection`, `Restore`), todos con diff antes de aplicar y deshacer disponible.
- Modo automático (opcional): sugiere eliminar un comentario redundante justo después de
  que lo escribes, vía CodeLens; no borra nada por su cuenta salvo que actives
  explícitamente `aiCodeCleaner.liveMode.autoApply`.
- CLI (`ai-code-cleaner`) para correr el mismo motor desde terminal o CI: dry-run,
  `--write`, `--check`. Ver `packages/cli/README.md`.

## Lenguajes soportados (MVP)

- TypeScript / JavaScript
- Python

Arquitectura pensada para agregar más lenguajes sin duplicar lógica (ver `CLAUDE.md`).

## Instalación

Todavía no está publicada en el VS Code Marketplace ni en npm — se genera localmente
desde el código fuente. Requiere Node.js 22+.

### Extensión de VS Code

```bash
git clone https://github.com/Mateo2888/Limpiar-Mi-Codigo-.git
cd Limpiar-Mi-Codigo-
npm install
cd packages/vscode
npm run package        # genera dist/ai-code-cleaner.vsix
```

Luego en VS Code: Command Palette → **`Extensions: Install from VSIX...`** → seleccionar
`packages/vscode/dist/ai-code-cleaner.vsix`.

Para probarla sin empaquetar (modo desarrollo): abrir `packages/vscode` en VS Code y
presionar **F5** (abre un Extension Development Host con la extensión ya cargada).

### CLI

```bash
npm install && npm run build   # desde la raíz del repo
node packages/cli/dist/cli.js archivo.ts          # dry-run
node packages/cli/dist/cli.js archivo.ts --write  # aplica los cambios
```

Detalle de flags en `packages/cli/README.md`.

## Desarrollo

Ver `CLAUDE.md` para arquitectura, decisiones y comandos de verificación.

## Licencia

Apache-2.0 (ver `LICENSE`).
