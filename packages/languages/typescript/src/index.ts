import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { CommentNode, LanguageAdapter, SourceRange } from '@ai-code-cleaner/core';
import { Language, Parser, type Node as TSNode } from 'web-tree-sitter';

type Grammar = 'typescript' | 'tsx' | 'javascript';

function grammarForExtension(ext: string): Grammar {
  switch (ext) {
    case '.tsx':
      return 'tsx';
    case '.ts':
    case '.mts':
    case '.cts':
      return 'typescript';
    default:
      return 'javascript';
  }
}

/**
 * Por defecto resuelve el `.wasm` vía `require.resolve` del paquete npm real
 * (funciona en el monorepo: tests, CLI). Si se pasa `wasmDir`, lo busca ahí en
 * su lugar — necesario porque, una vez empaquetado en un `.vsix`, la extensión
 * no tiene el `node_modules` del monorepo disponible, así que se vendorizan los
 * `.wasm` junto al bundle y se apunta ahí explícitamente (ver
 * `packages/vscode/scripts/prepare-runtime.mjs`).
 *
 * `createRequire(import.meta.url)` se crea perezosamente, solo en la rama que
 * de verdad la necesita: al empaquetar esta función con esbuild en formato
 * CJS (como hace la extensión de VS Code), `import.meta.url` queda vacío —
 * pero esa rama nunca se ejecuta ahí porque siempre se pasa `wasmDir`.
 */
function wasmPathFor(pkg: string, file: string, wasmDir?: string): string {
  if (wasmDir) return join(wasmDir, file);
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve(`${pkg}/package.json`);
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

async function loadLanguage(grammar: Grammar, wasmDir?: string): Promise<Language> {
  await ensureInitialized(wasmDir);
  const cacheKey = `${wasmDir ?? ''}:${grammar}`;
  let promise = languageCache.get(cacheKey);
  if (!promise) {
    promise = (async () => {
      const wasmPath =
        grammar === 'javascript'
          ? wasmPathFor('tree-sitter-javascript', 'tree-sitter-javascript.wasm', wasmDir)
          : wasmPathFor(
              'tree-sitter-typescript',
              grammar === 'tsx' ? 'tree-sitter-tsx.wasm' : 'tree-sitter-typescript.wasm',
              wasmDir,
            );
      return Language.load(readFileSync(wasmPath));
    })();
    languageCache.set(cacheKey, promise);
  }
  return promise;
}

async function parseWith(sourceText: string, grammar: Grammar, wasmDir?: string) {
  const language = await loadLanguage(grammar, wasmDir);
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(sourceText);
  if (!tree) {
    throw new Error(`ai-code-cleaner: failed to parse source with grammar "${grammar}"`);
  }
  return tree;
}

function collectComments(node: TSNode, out: CommentNode[]): void {
  if (node.type === 'comment') {
    const text = node.text;
    out.push({
      range: { startByte: node.startIndex, endByte: node.endIndex },
      text,
      isBlock: text.startsWith('/*'),
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

/**
 * Adaptador tree-sitter para JS/TS/TSX. `defaultExtension` decide qué gramática
 * usar (`.ts` por defecto); el core llama siempre con el mismo texto de origen,
 * así que un adapter se crea una vez por archivo/extensión conocida. `wasmDir`
 * es opcional y solo lo usan integraciones empaquetadas (ver arriba).
 */
export function createTypeScriptAdapter(
  defaultExtension = '.ts',
  wasmDir?: string,
): LanguageAdapter {
  const grammar = grammarForExtension(defaultExtension);

  return {
    id: 'typescript',
    extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],

    async findComments(sourceText: string): Promise<CommentNode[]> {
      const tree = await parseWith(sourceText, grammar, wasmDir);
      const out: CommentNode[] = [];
      collectComments(tree.rootNode, out);
      return out;
    },

    async nextCodeNodeText(sourceText: string, comment: CommentNode): Promise<string | null> {
      const tree = await parseWith(sourceText, grammar, wasmDir);
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
      const tree = await parseWith(sourceText, grammar, wasmDir);
      return nodeHasErrorInRange(tree.rootNode, range);
    },
  };
}

export function extensionToGrammar(ext: string): Grammar {
  return grammarForExtension(ext);
}
