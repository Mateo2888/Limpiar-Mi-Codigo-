/**
 * Regla v1 de detección de "ruido de IA": comentarios de línea (`//`, `#`) cortos
 * que contienen un verbo típico de agente de IA (en cualquier posición) y que no
 * contienen ninguna palabra que indique que el comentario aporta una razón/
 * decisión/limitación, ni un marcador estándar de la comunidad (TODO/FIXME/
 * directivas de linter), que se preservan siempre sin importar su contenido.
 *
 * Deliberadamente NO se intenta comparar el comentario contra los identificadores de
 * la línea de código siguiente: el código suele estar en inglés y el comentario en
 * español (o viceversa), así que un "subset de tokens" produciría falsos negativos
 * constantes. Esta regla es más estrecha a propósito — ante la duda, no se marca
 * como ruido (ver docs/decisions.md).
 */

const TRIGGER_WORDS = new Set([
  // Español
  'verificar',
  'verifica',
  'validar',
  'valida',
  'comprobar',
  'comprueba',
  'procesar',
  'procesa',
  'devolver',
  'devuelve',
  'retornar',
  'retorna',
  'retorno',
  'obtener',
  'obtiene',
  'inicializar',
  'inicializa',
  'importar',
  'importa',
  'cargar',
  'carga',
  'guardar',
  'guarda',
  'actualizar',
  'actualiza',
  'eliminar',
  'elimina',
  'crear',
  'crea',
  'agregar',
  'agrega',
  'añadir',
  'añade',
  'revisar',
  'revisa',
  'chequear',
  'chequea',
  'obtén',
  'define',
  'definir',
  'formatea',
  'formatear',
  'calcula',
  'calcular',
  'filtra',
  'filtrar',
  'genera',
  'generar',
  'maneja',
  'manejar',
  'muestra',
  'mostrar',
  'imprime',
  'imprimir',
  'inicia',
  'iniciar',
  'ejecuta',
  'ejecutar',
  'registra',
  'registrar',
  'construye',
  'construir',
  // English
  'verify',
  'verifies',
  'check',
  'checks',
  'validate',
  'validates',
  'process',
  'processes',
  'return',
  'returns',
  'retrieve',
  'retrieves',
  'initialize',
  'initializes',
  'import',
  'imports',
  'load',
  'loads',
  'save',
  'saves',
  'update',
  'updates',
  'delete',
  'deletes',
  'create',
  'creates',
  'add',
  'adds',
  'get',
  'gets',
  'set',
  'sets',
  'handle',
  'handles',
  'fetch',
  'fetches',
  'parse',
  'parses',
  'build',
  'builds',
  'generate',
  'generates',
  'calculate',
  'calculates',
  'format',
  'formats',
  'convert',
  'converts',
  'filter',
  'filters',
  'define',
  'defines',
  'log',
  'logs',
  'render',
  'renders',
  'run',
  'runs',
  'execute',
  'executes',
  'register',
  'registers',
]);

const EXCLUSION_SUBSTRINGS = [
  // Español: razón, decisión, limitación, advertencia
  'porque',
  'ya que',
  'debido a',
  'workaround',
  'nota:',
  'ojo',
  'cuidado',
  'límite',
  'limite',
  'limitación',
  'limitacion',
  'decisión',
  'decision',
  'ticket',
  'bug',
  'hack',
  'regional',
  'utc',
  'restricción',
  'restriccion',
  'banco',
  'aunque',
  'importante',
  'advertencia',
  'atención',
  'atencion',
  'warning',
  // English
  'because',
  'since',
  'note:',
  'caution',
  'limit',
  'limitation',
  'decision',
  'although',
  // Marcadores estándar de la comunidad (TODO/FIXME/etc.) y directivas de
  // linter/type-checker: nunca son "ruido de IA" aunque su texto contenga una
  // palabra disparadora (ej. "// TODO: validate this later" no debe borrarse
  // solo porque "validate" está en la lista de verbos).
  'todo',
  'fixme',
  'xxx',
  'wip',
  'deprecated',
  'eslint-disable',
  'ts-ignore',
  'ts-expect-error',
  'type: ignore',
  'noqa',
  'nolint',
  'pragma',
];

const MAX_NOISE_WORD_COUNT = 8;

function stripCommentMarker(text: string): string {
  return text
    .replace(/^\/\/\s?/, '')
    .replace(/^#\s?/, '')
    .trim();
}

export function isNoiseLineComment(rawCommentText: string): boolean {
  const normalized = stripCommentMarker(rawCommentText);
  if (normalized.length === 0) return false;

  const lower = normalized.toLowerCase();
  if (EXCLUSION_SUBSTRINGS.some((phrase) => lower.includes(phrase))) {
    return false;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > MAX_NOISE_WORD_COUNT) return false;

  const cleanedWords = words.map((w) => w.toLowerCase().replace(/[.,;:!¿?()"'`]/g, ''));
  return cleanedWords.some((w) => TRIGGER_WORDS.has(w));
}
