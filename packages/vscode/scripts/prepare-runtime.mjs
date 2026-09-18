// Prepara los assets que el bundle de esbuild no puede/debe embeber, para que
// la extensión empaquetada (.vsix) no dependa del node_modules del monorepo:
//
// 1. Copia los .wasm reales (motor de tree-sitter + gramáticas) a dist/wasm/.
//    Las gramáticas se leen como bytes crudos (readFileSync) en tiempo de
//    ejecución, así que no hace falta el paquete npm completo, solo el .wasm.
//
// 2. Vendoriza el paquete real `web-tree-sitter` (sin bundlear) dentro de
//    node_modules/ de este paquete. web-tree-sitter usa `import.meta.url`
//    internamente para ubicar su propio runtime .wasm y para su glue code de
//    Emscripten; al bundlearlo con esbuild en formato CJS ese `import.meta.url`
//    queda vacío y todo se rompe. Su propio build CJS (`tree-sitter.cjs`, vía
//    "exports"."require" en su package.json) no tiene ese problema porque usa
//    `__dirname` real — así que se marca `external` en esbuild y se vendoriza
//    el paquete tal cual, como si fuera una dependencia real instalada.
//
// Todas las resoluciones se hacen SIEMPRE contra el node_modules raíz del
// monorepo (no contra el propio directorio de este script), para que una
// corrida no termine resolviendo su propia copia vendorizada de una corrida
// anterior en vez del paquete real instalado por npm.
//
// Se corre como parte de "npm run build" en este paquete.
import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(packageRoot, '..', '..');
const rootRequire = createRequire(join(repoRoot, 'package.json'));

const wasmOutDir = join(packageRoot, 'dist', 'wasm');
mkdirSync(wasmOutDir, { recursive: true });

// web-tree-sitter declara "exports" en su package.json sin exponer
// "./package.json" como subpath, así que su directorio se resuelve vía su
// entrada principal en vez de vía require.resolve(pkg + '/package.json').
function packageDir(pkg) {
  if (pkg === 'web-tree-sitter') return dirname(rootRequire.resolve('web-tree-sitter'));
  return dirname(rootRequire.resolve(`${pkg}/package.json`));
}

const wasmFiles = [
  ['web-tree-sitter/tree-sitter.wasm', 'tree-sitter.wasm'],
  ['tree-sitter-typescript/tree-sitter-typescript.wasm', 'tree-sitter-typescript.wasm'],
  ['tree-sitter-typescript/tree-sitter-tsx.wasm', 'tree-sitter-tsx.wasm'],
  ['tree-sitter-javascript/tree-sitter-javascript.wasm', 'tree-sitter-javascript.wasm'],
  ['tree-sitter-python/tree-sitter-python.wasm', 'tree-sitter-python.wasm'],
  ['tree-sitter-go/tree-sitter-go.wasm', 'tree-sitter-go.wasm'],
  ['tree-sitter-java/tree-sitter-java.wasm', 'tree-sitter-java.wasm'],
  ['tree-sitter-c-sharp/tree-sitter-c_sharp.wasm', 'tree-sitter-c_sharp.wasm'],
];

for (const [specifier, destName] of wasmFiles) {
  const [pkg, ...rest] = specifier.split('/');
  const sourcePath = join(packageDir(pkg), ...rest);
  copyFileSync(sourcePath, join(wasmOutDir, destName));
  console.log(`prepare-runtime: ${specifier} -> dist/wasm/${destName}`);
}

const vendoredDir = join(packageRoot, 'node_modules', 'web-tree-sitter');
rmSync(vendoredDir, { recursive: true, force: true });
cpSync(packageDir('web-tree-sitter'), vendoredDir, { recursive: true });
console.log('prepare-runtime: vendored web-tree-sitter -> node_modules/web-tree-sitter');
