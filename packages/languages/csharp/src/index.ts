import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { CommentNode, LanguageAdapter, SourceRange } from '@ai-code-cleaner/core';
import { Language, Parser, type Node as TSNode } from 'web-tree-sitter';

// El paquete npm es "tree-sitter-c-sharp" pero el .wasm que publica se llama
// "tree-sitter-c_sharp.wasm" (con guion bajo) — nombres distintos, hay que
// mantenerlos separados en vez de derivar uno del otro.
function wasmPathFor(wasmDir?: string): string {
  const file = 'tree-sitter-c_sharp.wasm';
  if (wasmDir) return join(wasmDir, file);
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('tree-sitter-c-sharp/package.json');
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
    promise = (async () => Language.load(readFileSync(wasmPathFor(wasmDir))))();
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
    throw new Error('ai-code-cleaner: failed to parse C# source');
  }
  return tree;
}

/**
 * Igual que en Go: los comentarios de documentación XML de C# (convención
 * `/// <summary>...`, inmediatamente arriba de la declaración, sin línea en
 * blanco entre medio) son comentarios de LÍNEA (`//`/`///`), no de bloque —
 * la gramática ni siquiera distingue `///` de `//` como tokens distintos. Sin
 * esta protección, la heurística de ruido podría borrar la documentación XML
 * de un miembro público. Ver `packages/languages/go/src/index.ts` para el
 * mismo mecanismo con más detalle en los comentarios.
 */
const DOC_TARGET_TYPES = new Set([
  'class_declaration',
  'struct_declaration',
  'enum_declaration',
  'interface_declaration',
  'record_declaration',
  'method_declaration',
  'constructor_declaration',
  'destructor_declaration',
  'property_declaration',
  'field_declaration',
  'event_declaration',
  'event_field_declaration',
  'delegate_declaration',
  'namespace_declaration',
  'operator_declaration',
  'indexer_declaration',
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
export function createCSharpAdapter(wasmDir?: string): LanguageAdapter {
  return {
    id: 'csharp',
    extensions: ['.cs'],

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
