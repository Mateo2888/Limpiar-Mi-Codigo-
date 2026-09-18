#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { clean } from '@ai-code-cleaner/core';
import { adapterForExtension, extensionOf } from '@ai-code-cleaner/registry';

interface Options {
  write: boolean;
  check: boolean;
  files: string[];
}

function parseArgs(argv: string[]): Options {
  const files: string[] = [];
  let write = false;
  let check = false;
  for (const arg of argv) {
    if (arg === '--write' || arg === '-w') write = true;
    else if (arg === '--check') check = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else files.push(arg);
  }
  return { write, check, files };
}

function printHelp(): void {
  console.log(
    [
      'ai-code-cleaner [archivos...] [--write] [--check]',
      '',
      'Elimina comentarios de ruido de IA sin tocar la lógica del código.',
      '',
      '  (sin flags)  modo dry-run: reporta qué se eliminaría, no toca nada.',
      '  --write      aplica los cambios al archivo.',
      '  --check      no toca nada; termina con código 1 si algún archivo cambiaría',
      '               (para usar en CI).',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.files.length === 0) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  let anyWouldChange = false;
  let hadError = false;

  for (const file of options.files) {
    const ext = extensionOf(file);
    const adapter = adapterForExtension(ext);
    if (!adapter) {
      console.error(`ai-code-cleaner: "${file}" no está soportado (extensión "${ext}").`);
      hadError = true;
      continue;
    }

    let originalText: string;
    try {
      originalText = readFileSync(file, 'utf8');
    } catch (err) {
      console.error(`ai-code-cleaner: no se pudo leer "${file}": ${(err as Error).message}`);
      hadError = true;
      continue;
    }

    const result = await clean(originalText, adapter);

    if (result.abstained) {
      console.log(`${file}: errores de sintaxis — no se tocó nada por seguridad.`);
      continue;
    }

    if (result.edits.length === 0) {
      console.log(`${file}: sin comentarios de ruido.`);
      continue;
    }

    anyWouldChange = true;
    console.log(`${file}: ${result.edits.length} comentario(s) de ruido detectado(s).`);

    if (options.write) {
      writeFileSync(file, result.output, 'utf8');
      console.log(`${file}: aplicado.`);
    }
  }

  if (options.check && anyWouldChange) {
    process.exitCode = 1;
  } else if (hadError) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('ai-code-cleaner: error inesperado', err);
  process.exitCode = 1;
});
