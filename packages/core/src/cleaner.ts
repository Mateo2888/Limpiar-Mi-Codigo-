import { applyEdits, buildRemovalEdit } from './diffEngine.js';
import { isNoiseLineComment } from './rules/redundancy.js';
import type { Edit, LanguageAdapter } from './types.js';

export interface CleanResult {
  output: string;
  edits: Edit[];
  /** true si el archivo no se tocó porque el parser no pudo entender su estructura. */
  abstained: boolean;
}

/**
 * Limpia el ruido de IA de `sourceText`. Nunca toca comentarios de bloque (JSDoc,
 * docstrings) en v1 — solo comentarios de línea que matchean la regla de ruido.
 * Si el árbol tiene errores de parseo, se abstiene por completo (requisito de
 * seguridad: ante duda estructural, no tocar nada).
 */
export async function clean(sourceText: string, adapter: LanguageAdapter): Promise<CleanResult> {
  const fullRange = { startByte: 0, endByte: sourceText.length };
  if (await adapter.hasParseErrorNear(sourceText, fullRange)) {
    return { output: sourceText, edits: [], abstained: true };
  }

  const comments = await adapter.findComments(sourceText);
  const edits: Edit[] = [];

  for (const comment of comments) {
    if (comment.isBlock) continue;
    if (!isNoiseLineComment(comment.text)) continue;
    edits.push(buildRemovalEdit(sourceText, comment));
  }

  const output = applyEdits(sourceText, edits);
  return { output, edits, abstained: false };
}
