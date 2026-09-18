import type { LanguageAdapter } from '@ai-code-cleaner/core';
import { createPythonAdapter } from '@ai-code-cleaner/lang-python';
import { createTypeScriptAdapter } from '@ai-code-cleaner/lang-typescript';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const PY_EXTENSIONS = new Set(['.py', '.pyi']);

export const SUPPORTED_EXTENSIONS: readonly string[] = [...TS_EXTENSIONS, ...PY_EXTENSIONS];

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot);
}

/**
 * Único lugar donde se decide qué adaptador de lenguaje usar por extensión.
 * Usado tanto por la extensión de VS Code como por la CLI, para no duplicar
 * esta lista en cada integración.
 */
export function adapterForExtension(ext: string): LanguageAdapter | null {
  if (TS_EXTENSIONS.has(ext)) return createTypeScriptAdapter(ext);
  if (PY_EXTENSIONS.has(ext)) return createPythonAdapter();
  return null;
}
