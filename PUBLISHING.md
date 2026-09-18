# Publicar en el VS Code Marketplace

Publisher ya creado: `ai-code-cleaner` (ver `packages/vscode/package.json`).
Todo el resto del `package.json` (categorías, keywords, icon, license) ya está listo.
Estos son los únicos pasos que faltan, y requieren tu login personal — no se pueden
hacer desde una sesión de Claude Code.

## 1. Generar el token (una sola vez)

1. Ir a https://dev.azure.com
2. Ícono de usuario (arriba a la derecha) → **Personal Access Tokens** → **New Token**
3. Organization: **All accessible organizations**
4. Scope: **Marketplace → Manage**
5. Copiar el token — solo se muestra una vez.

## 2. Login (una sola vez por máquina)

```bash
cd packages/vscode
npx vsce login ai-code-cleaner
# pega el token cuando lo pida
```

## 3. Publicar

```bash
npx vsce publish
```

Esto compila (`npm run build`), empaqueta y sube la extensión en un solo paso.
Tarda unos minutos en aparecer si buscas "AI Code Cleaner" en la pestaña
Extensions de VS Code o en https://marketplace.visualstudio.com.

## 4. Futuras actualizaciones

Cada vez que quieras publicar una mejora:

1. Sube el número de versión en `packages/vscode/package.json` (ej. `0.1.0` → `0.1.1`).
2. `npx vsce publish` de nuevo.

A todos los que ya la tengan instalada les llega la actualización sola, sin que
hagan nada.

## Si algo falla

- `npx vsce publish` sin login previo pide el token directo (puedes saltarte el
  paso 2 y pegarlo ahí si lo prefieres).
- Si el `package.json` cambió de manos de campos obligatorios, `vsce` avisa
  exactamente cuál falta antes de subir nada — no se publica a medias.
