import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { CommentNode, LanguageAdapter, SourceRange } from '@ai-code-cleaner/core';
import { Language, Parser, type Node as TSNode } from 'web-tree-sitter';

function wasmPathFor(file: string, wasmDir?: string): string {
  if (wasmDir) return join(wasmDir, file);
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('tree-sitter-go/package.json');
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
      const wasmPath = wasmPathFor('tree-sitter-go.wasm', wasmDir);
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
    throw new Error('ai-code-cleaner: failed to parse Go source');
  }
  return tree;
}

/**
 * En Go, a diferencia de JSDoc en TS, los comentarios de documentación
 * (convención godoc: "// FuncName hace X", justo arriba de la declaración,
 * sin línea en blanco entre medio) son comentarios de LÍNEA (`//`), no de
 * bloque — así que la regla genérica ("solo bloques se preservan siempre")
 * no los protegería, y podrían perder un doc comment real de una función
 * exportada. Se detecta ese patrón explícitamente y se marca como
 * `isBlock: true` (reutilizando la exclusión que el core ya aplica a
 * bloques) para conservarlo siempre, sin cambiar nada en `core`.
 */
const DOC_TARGET_TYPES = new Set([
  'function_declaration',
  'method_declaration',
  'type_declaration',
  'const_declaration',
  'var_declaration',
  'package_clause',
]);

function leadsToDeclarationWithoutGap(node: TSNode): boolean {
  let current: TSNode = node;
  for (;;) {
    const next: TSNode | null = current.nextNamedSibling;
    if (!next) return false;
    const noBlankLineBetween = next.startPosition.row <= current.endPosition.row + 1;
    if (!noBlankLineBetween) return false;
    if (next.type === 'comment') {
      current = next;
      continue;
    }
    return DOC_TARGET_TYPES.has(next.type);
  }
}

function collectComments(node: TSNode, out: CommentNode[]): void {
  if (node.type === 'comment') {
    const text = node.text;
    out.push({
      range: { startByte: node.startIndex, endByte: node.endIndex },
      text,
      isBlock: text.startsWith('/*') || leadsToDeclarationWithoutGap(node),
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
export function createGoAdapter(wasmDir?: string): LanguageAdapter {
  return {
    id: 'go',
    extensions: ['.go'],

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
