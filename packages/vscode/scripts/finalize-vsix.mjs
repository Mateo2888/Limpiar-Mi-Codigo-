// `vsce package` (sin --no-dependencies) intenta ser "inteligente" con
// monorepos npm workspaces: sigue los symlinks de node_modules/@ai-code-cleaner/*
// hacia sus paquetes reales (packages/core, packages/registry, ...) y termina
// arrastrando el repo entero, chocando con un path relativo inválido
// ("extension/../../.gitignore"). `--no-dependencies` evita eso, pero también
// descarta *todo* node_modules — incluido node_modules/web-tree-sitter, que sí
// necesitamos (ver prepare-runtime.mjs sobre por qué no se puede bundlear).
//
// Como un .vsix es simplemente un .zip, la solución es empaquetar con
// --no-dependencies (limpio) y después inyectar node_modules/web-tree-sitter
// directamente en el archivo con el binario `zip`, en vez de pelear con la
// lógica de dependencias de vsce.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const vsixPath = join(packageRoot, 'dist', 'ai-code-cleaner.vsix');

console.log('finalize-vsix: running vsce package --no-dependencies...');
execFileSync('npx', ['@vscode/vsce', 'package', '--no-dependencies', '--out', vsixPath], {
  cwd: packageRoot,
  stdio: 'inherit',
});

const stageRoot = mkdtempSync(join(tmpdir(), 'ai-code-cleaner-vsix-'));
const stageTarget = join(stageRoot, 'extension', 'node_modules', 'web-tree-sitter');
mkdirSync(dirname(stageTarget), { recursive: true });
cpSync(join(packageRoot, 'node_modules', 'web-tree-sitter'), stageTarget, { recursive: true });

console.log('finalize-vsix: injecting node_modules/web-tree-sitter into the .vsix...');
execFileSync('zip', ['-rq', vsixPath, 'extension/node_modules/web-tree-sitter'], {
  cwd: stageRoot,
  stdio: 'inherit',
});
rmSync(stageRoot, { recursive: true, force: true });

const listing = execFileSync('unzip', ['-l', vsixPath]).toString();
if (!listing.includes('extension/node_modules/web-tree-sitter/')) {
  throw new Error('finalize-vsix: web-tree-sitter did not make it into the .vsix, aborting.');
}
console.log(`finalize-vsix: done -> ${vsixPath}`);
