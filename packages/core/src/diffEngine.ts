import type { CommentNode, Edit } from './types.js';

/**
 * Construye la edición que borra un comentario de línea, sin tocar nada más:
 * - Si el comentario ocupa toda su línea (solo espacios antes y después), se borra
 *   la línea completa incluyendo su salto de línea, para no dejar una línea en blanco.
 * - Si es un comentario final (`code; // comentario`), solo se borra desde el
 *   comentario (y el espacio en blanco que lo precede) hasta el fin de línea.
 * Preserva el resto del archivo byte a byte, incluyendo el estilo de saltos de línea.
 */
export function buildRemovalEdit(sourceText: string, comment: CommentNode): Edit {
  const { startByte, endByte } = comment.range;

  const lineStart = sourceText.lastIndexOf('\n', startByte - 1) + 1;
  const nextNewline = sourceText.indexOf('\n', endByte);
  const hasTrailingNewline = nextNewline !== -1;
  const lineEnd = hasTrailingNewline ? nextNewline : sourceText.length;

  const before = sourceText.slice(lineStart, startByte);
  const after = sourceText.slice(endByte, lineEnd);
  const isOwnLine = before.trim().length === 0 && after.trim().length === 0;

  if (isOwnLine) {
    if (hasTrailingNewline) {
      return {
        range: { startByte: lineStart, endByte: lineEnd + 1 },
        replacement: '',
        ruleId: 'noise-comment',
      };
    }
    const removeFrom = lineStart > 0 ? lineStart - 1 : 0;
    return {
      range: { startByte: removeFrom, endByte: lineEnd },
      replacement: '',
      ruleId: 'noise-comment',
    };
  }

  const trailingWhitespace = /\s*$/.exec(before)?.[0] ?? '';
  return {
    range: { startByte: startByte - trailingWhitespace.length, endByte },
    replacement: '',
    ruleId: 'noise-comment',
  };
}

/** Aplica ediciones de mayor a menor offset para que no se invaliden entre sí. */
export function applyEdits(sourceText: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.range.startByte - a.range.startByte);
  let result = sourceText;
  for (const edit of sorted) {
    result =
      result.slice(0, edit.range.startByte) + edit.replacement + result.slice(edit.range.endByte);
  }
  return result;
}
