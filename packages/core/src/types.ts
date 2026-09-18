/**
 * Contrato entre el core y cada adaptador de lenguaje. Sin implementación aquí
 * todavía (FASE 3) — solo la forma, para que los fixtures de test y los
 * adaptadores de lenguaje se diseñen contra la misma interfaz desde el inicio.
 */

export interface SourceRange {
  startByte: number;
  endByte: number;
}

export interface CommentNode {
  range: SourceRange;
  text: string;
  /** true si es de bloque (/* *\/, """ """), false si es de línea (//, #) */
  isBlock: boolean;
}

export interface LanguageAdapter {
  readonly id: string;
  readonly extensions: string[];

  /**
   * Devuelve todos los nodos de comentario del árbol, en orden.
   * Async porque cargar la gramática (WASM) es asíncrono; una vez cargada,
   * el propio parseo es rápido y se cachea por instancia de adapter.
   */
  findComments(sourceText: string): Promise<CommentNode[]>;

  /** Nodo de código no-comentario inmediatamente siguiente a un comentario, o null. */
  nextCodeNodeText(sourceText: string, comment: CommentNode): Promise<string | null>;

  /** true si el árbol tiene errores de parseo en la región dada (abstenerse). */
  hasParseErrorNear(sourceText: string, range: SourceRange): Promise<boolean>;
}

export interface Edit {
  range: SourceRange;
  replacement: string;
  ruleId: string;
}
