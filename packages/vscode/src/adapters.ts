import type { LanguageAdapter } from '@ai-code-cleaner/core';
import { createPythonAdapter } from '@ai-code-cleaner/lang-python';
import { createTypeScriptAdapter } from '@ai-code-cleaner/lang-typescript';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const PY_EXTENSIONS = new Set(['.py', '.pyi']);

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot);
}

/** Único lugar donde se decide qué adaptador de lenguaje usar por extensión. */
export function adapterForExtension(ext: string): LanguageAdapter | null {
  if (TS_EXTENSIONS.has(ext)) return createTypeScriptAdapter(ext);
  if (PY_EXTENSIONS.has(ext)) return createPythonAdapter();
  return null;
}
