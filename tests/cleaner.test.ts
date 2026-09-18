import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LanguageAdapter } from '../packages/core/src/index.js';
import { clean } from '../packages/core/src/index.js';
import { createGoAdapter } from '../packages/languages/go/src/index.js';
import { createJavaAdapter } from '../packages/languages/java/src/index.js';
import { createPythonAdapter } from '../packages/languages/python/src/index.js';
import { createTypeScriptAdapter } from '../packages/languages/typescript/src/index.js';

function listCases(dir: string): string[] {
  return readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory());
}

/**
 * Prueba de invariancia estructural: si quitamos los nodos de comentario del
 * árbol de `input` y del árbol de `output`, deben quedar exactamente los mismos
 * nodos de código (mismo tipo y mismo texto, en el mismo orden). Si esto falla,
 * la transformación tocó lógica y no solo comentarios, sin importar si el texto
 * coincide por casualidad con `expected`.
 */
async function codeSkeleton(adapter: LanguageAdapter, source: string): Promise<string> {
  const comments = await adapter.findComments(source);
  let skeleton = source;
  const sorted = [...comments].sort((a, b) => b.range.startByte - a.range.startByte);
  for (const c of sorted) {
    skeleton = skeleton.slice(0, c.range.startByte) + skeleton.slice(c.range.endByte);
  }
  // Borrar un comentario de línea entera también borra su salto de línea (para no
  // dejar una línea en blanco huérfana) — eso es intencional en diffEngine, no un
  // cambio de lógica. Normalizamos líneas en blanco/espacios finales antes de
  // comparar para que la prueba de invariancia se enfoque en el código, no en el
  // efecto colateral esperado de borrar una línea.
  return skeleton
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function runFixtureSuite(
  languageLabel: string,
  fixturesSubdir: string,
  extension: string,
  createAdapter: () => LanguageAdapter,
): void {
  const fixturesDir = fileURLToPath(new URL(`./fixtures/${fixturesSubdir}`, import.meta.url));

  describe(`cleaner (${languageLabel} fixtures)`, () => {
    const adapter = createAdapter();
    const cases = listCases(fixturesDir);

    it('found the expected fixture cases', () => {
      expect(cases.length).toBeGreaterThanOrEqual(10);
    });

    for (const caseName of cases) {
      it(`${caseName}: matches expected output and preserves logic`, async () => {
        const caseDir = join(fixturesDir, caseName);
        const input = readFileSync(join(caseDir, `input${extension}`), 'utf8');
        const expected = readFileSync(join(caseDir, `expected${extension}`), 'utf8');

        const result = await clean(input, adapter);

        expect(result.output).toBe(expected);

        if (!result.abstained) {
          const inputSkeleton = await codeSkeleton(adapter, input);
          const outputSkeleton = await codeSkeleton(adapter, result.output);
          expect(outputSkeleton).toBe(inputSkeleton);

          const hasError = await adapter.hasParseErrorNear(result.output, {
            startByte: 0,
            endByte: result.output.length,
          });
          expect(hasError).toBe(false);
        }
      });
    }

    it('abstains entirely when the input has a syntax error', async () => {
      const caseDir = join(fixturesDir, '10-parse-error-abstain');
      const input = readFileSync(join(caseDir, `input${extension}`), 'utf8');
      const result = await clean(input, adapter);
      expect(result.abstained).toBe(true);
      expect(result.output).toBe(input);
    });
  });
}

runFixtureSuite('TypeScript', 'typescript', '.ts', () => createTypeScriptAdapter('.ts'));
runFixtureSuite('Python', 'python', '.py', () => createPythonAdapter());
runFixtureSuite('Go', 'go', '.go', () => createGoAdapter());
runFixtureSuite('Java', 'java', '.java', () => createJavaAdapter());
