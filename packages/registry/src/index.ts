import type { LanguageAdapter } from '@ai-code-cleaner/core';
import { createGoAdapter } from '@ai-code-cleaner/lang-go';
import { createPythonAdapter } from '@ai-code-cleaner/lang-python';
import { createTypeScriptAdapter } from '@ai-code-cleaner/lang-typescript';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const PY_EXTENSIONS = new Set(['.py', '.pyi']);
const GO_EXTENSIONS = new Set(['.go']);

export const SUPPORTED_EXTENSIONS: readonly string[] = [
  ...TS_EXTENSIONS,
  ...PY_EXTENSIONS,
  ...GO_EXTENSIONS,
];

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot);
}

/**
 * Único lugar donde se decide qué adaptador de lenguaje usar por extensión.
 * Usado tanto por la extensión de VS Code como por la CLI, para no duplicar
 * esta lista en cada integración.
 *
 * `wasmDir` es opcional: solo lo pasa una integración empaquetada (el `.vsix`
 * de VS Code) que vendorizó los `.wasm` de las gramáticas junto a su bundle;
 * la CLI y los tests lo dejan `undefined` y usan la resolución vía node_modules
 * del monorepo tal cual.
 */
export function adapterForExtension(ext: string, wasmDir?: string): LanguageAdapter | null {
  if (TS_EXTENSIONS.has(ext)) return createTypeScriptAdapter(ext, wasmDir);
  if (PY_EXTENSIONS.has(ext)) return createPythonAdapter(wasmDir);
  if (GO_EXTENSIONS.has(ext)) return createGoAdapter(wasmDir);
  return null;
}
