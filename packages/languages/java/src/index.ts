import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { CommentNode, LanguageAdapter, SourceRange } from '@ai-code-cleaner/core';
import { Language, Parser, type Node as TSNode } from 'web-tree-sitter';

function wasmPathFor(file: string, wasmDir?: string): string {
  if (wasmDir) return join(wasmDir, file);
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('tree-sitter-java/package.json');
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
      const wasmPath = wasmPathFor('tree-sitter-java.wasm', wasmDir);
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
    throw new Error('ai-code-cleaner: failed to parse Java source');
  }
  return tree;
}

/**
 * A diferencia de JS/TS/Python/Go (un solo tipo de nodo `comment`, distinguido
 * por el texto), la gramática de tree-sitter-java usa dos tipos de nodo
 * distintos: `line_comment` (`//`) y `block_comment` (`/* *\/` y Javadoc
 * `/** *\/`). Javadoc es siempre `block_comment`, así que ya queda protegido
 * por la regla del core ("los bloques se preservan siempre") sin necesitar
 * ninguna lógica adicional como la que sí hizo falta en Go (donde los doc
 * comments son de línea).
 */
function collectComments(node: TSNode, out: CommentNode[]): void {
  if (node.type === 'line_comment' || node.type === 'block_comment') {
    out.push({
      range: { startByte: node.startIndex, endByte: node.endIndex },
      text: node.text,
      isBlock: node.type === 'block_comment',
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

function isCommentType(type: string): boolean {
  return type === 'line_comment' || type === 'block_comment';
}

/** `wasmDir` opcional: solo lo usan integraciones empaquetadas (ver lang-typescript). */
export function createJavaAdapter(wasmDir?: string): LanguageAdapter {
  return {
    id: 'java',
    extensions: ['.java'],

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
        if (sibling && !isCommentType(sibling.type)) return sibling.text;
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
