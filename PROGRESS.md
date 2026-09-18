# Progreso

Formato: fase, qué está hecho, qué falta. Actualizar al cerrar cada incremento.

## FASE 0 — Investigación ✅

- Prior art revisada: `Goldziher/uncomment` (Rust, tree-sitter, MIT, borrado por categoría
  sin heurística de paráfrasis), extensiones de marketplace existentes (`Remove IA Comments`,
  `CommentsCleaner`, etc. — todas manuales, sin diff estructurado ni modo automático).
- Confirmado: tree-sitter (`web-tree-sitter`, WASM) es la opción correcta frente a
  compiler APIs por lenguaje o regex. Detalle en `docs/decisions.md`.

## FASE 1 — Diseño ✅

- Arquitectura de paquetes definida (`core` / `languages/*` / `vscode` / `cli`).
- Dos modos de uso definidos: manual (comando + diff) y automático (live watcher con
  sugerencia, no borrado silencioso por defecto).
- Heurística v1 definida: paráfrasis de la línea siguiente + lista de exclusiones.
- Estrategia de pruebas definida: fixtures input/expected + test de invariancia estructural.

## FASE 2 — Harness ✅ (este commit)

- `CLAUDE.md`, `README.md`, `PROGRESS.md`, `docs/decisions.md` creados.
- Estructura de paquetes creada (vacía, solo `package.json` + `tsconfig` por paquete).
- Fixtures de test creadas para TypeScript cubriendo los 12 casos del enunciado
  (`tests/fixtures/typescript/*`). **Pendiente**: fixtures equivalentes para Python.
- Tooling raíz: npm workspaces, `biome.json`, `tsconfig.base.json`, `.gitignore`,
  hook de pre-commit local (`.githooks/pre-commit`, sin husky).
- **No hay motor de limpieza implementado todavía** — los scripts `npm test` / `npm run
  typecheck` fallarán hasta la FASE 3 porque no existe código en `packages/core`.

## FASE 3 — MVP (pendiente)

- [ ] Implementar `packages/languages/typescript` (adapter tree-sitter, detectar nodos
      de comentario, saber qué nodo sigue a cada uno, saber si un rango está dentro de string).
- [ ] Implementar `packages/core` (reglas de detección, motor de diff por rangos).
- [ ] Hacer pasar todos los fixtures de `tests/fixtures/typescript/*`.
- [ ] Implementar `packages/languages/python` + sus fixtures.
- [ ] Implementar `packages/vscode`: comando `Clean Current File` + `Preview Changes` con
      diff nativo de VS Code y aplicar/rechazar vía `WorkspaceEdit`.
- [ ] Implementar modo live (watcher con debounce + CodeLens de sugerencia), detrás de
      configuración (`aiCodeCleaner.liveMode.enabled` / `.autoApply`).

## FASE 4 — Validación (pendiente)

- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` en verde.
- [ ] Prueba manual en VS Code real con archivos reales generados por un agente de IA.

## FASE 5 — CLI (pendiente, después de que el MVP sea estable)

- [ ] `packages/cli` reutilizando `core` + `languages/*` sin duplicar lógica.
