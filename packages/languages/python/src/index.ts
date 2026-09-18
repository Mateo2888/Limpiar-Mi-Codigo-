import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { CommentNode, LanguageAdapter, SourceRange } from '@ai-code-cleaner/core';
import { Language, Parser, type Node as TSNode } from 'web-tree-sitter';

/**
 * `createRequire(import.meta.url)` se crea perezosamente, solo cuando `wasmDir`
 * no viene dado: al empaquetar con esbuild en CJS (extensión de VS Code),
 * `import.meta.url` queda vacío, pero esa rama nunca corre ahí porque siempre
 * se pasa `wasmDir` (ver `packages/vscode/scripts/prepare-runtime.mjs`).
 */
function wasmPathFor(file: string, wasmDir?: string): string {
  if (wasmDir) return join(wasmDir, file);
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('tree-sitter-python/package.json');
  return join(dirname(pkgJsonPath), file);
}

let initPromise: Promise<void> | null = null;
function ensureInitialized(wasmDir?: string): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init(
      wasmDir ? { locateFile: (path: string) => join(wasmDir, path) } : undefined,
    );
  }
  return initPromise;
}

const languageCache = new Map<string, Promise<Language>>();
async function loadLanguage(wasmDir?: string): Promise<Language> {
  await ensureInitialized(wasmDir);
  const cacheKey = wasmDir ?? '';
  let promise = languageCache.get(cacheKey);
  if (!promise) {
    promise = (async () => {
      const wasmPath = wasmPathFor('tree-sitter-python.wasm', wasmDir);
      return Language.load(readFileSync(wasmPath));
    })();
    languageCache.set(cacheKey, promise);
  }
  return promise;
}

async function parseWith(sourceText: string, wasmDir?: string) {
  const language = await loadLanguage(wasmDir);
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(sourceText);
  if (!tree) {
    throw new Error('ai-code-cleaner: failed to parse Python source');
  }
  return tree;
}

/**
 * En Python los docstrings son literales de string (`expression_statement` ->
 * `string`), no nodos de comentario — a diferencia de JS/TS no hace falta
 * distinguir "comentario de bloque tipo doc" de "comentario de línea": el único
 * tipo de nodo de comentario en la gramática es `comment` (`#`), y los
 * docstrings nunca aparecen aquí, así que quedan siempre intactos sin lógica
 * adicional.
 */
function collectComments(node: TSNode, out: CommentNode[]): void {
  if (node.type === 'comment') {
    out.push({
      range: { startByte: node.startIndex, endByte: node.endIndex },
      text: node.text,
      isBlock: false,
    });
    return;
  }
  for (const child of node.children) {
    if (child) collectComments(child, out);
  }
}

function rangesOverlap(a: SourceRange, b: SourceRange): boolean {
  return a.startByte < b.endByte && b.startByte < a.endByte;
}

function nodeHasErrorInRange(node: TSNode, range: SourceRange): boolean {
  if (!rangesOverlap({ startByte: node.startIndex, endByte: node.endIndex }, range)) {
    return false;
  }
  if (node.type === 'ERROR' || node.isMissing) return true;
  for (const child of node.children) {
    if (child && nodeHasErrorInRange(child, range)) return true;
  }
  return false;
}

/** `wasmDir` opcional: solo lo usan integraciones empaquetadas (ver lang-typescript). */
export function createPythonAdapter(wasmDir?: string): LanguageAdapter {
  return {
    id: 'python',
    extensions: ['.py', '.pyi'],

    async findComments(sourceText: string): Promise<CommentNode[]> {
      const tree = await parseWith(sourceText, wasmDir);
      const out: CommentNode[] = [];
      collectComments(tree.rootNode, out);
      return out;
    },

    async nextCodeNodeText(sourceText: string, comment: CommentNode): Promise<string | null> {
      const tree = await parseWith(sourceText, wasmDir);
      let node: TSNode | null = tree.rootNode.descendantForIndex(
        comment.range.startByte,
        comment.range.endByte,
      );
      while (node) {
        const sibling: TSNode | null = node.nextSibling;
        if (sibling && sibling.type !== 'comment') return sibling.text;
        node = sibling ?? node.parent;
      }
      return null;
    },

    async hasParseErrorNear(sourceText: string, range: SourceRange): Promise<boolean> {
      const tree = await parseWith(sourceText, wasmDir);
      return nodeHasErrorInRange(tree.rootNode, range);
    },
  };
}
