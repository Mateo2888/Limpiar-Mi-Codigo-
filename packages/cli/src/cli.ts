#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { clean } from '@ai-code-cleaner/core';
import { adapterForExtension, extensionOf } from '@ai-code-cleaner/registry';

interface Options {
  write: boolean;
  check: boolean;
  json: boolean;
  stdin: boolean;
  stdinFilepath: string | null;
  files: string[];
}

type FileStatus = 'changed' | 'unchanged' | 'abstained' | 'unsupported' | 'error';

interface FileResult {
  file: string;
  status: FileStatus;
  noiseCount: number;
  applied: boolean;
  error: string | null;
}

function parseArgs(argv: string[]): Options {
  const files: string[] = [];
  let write = false;
  let check = false;
  let json = false;
  let stdin = false;
  let stdinFilepath: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--write' || arg === '-w') write = true;
    else if (arg === '--check') check = true;
    else if (arg === '--json') json = true;
    else if (arg === '--stdin') stdin = true;
    else if (arg === '--stdin-filepath') stdinFilepath = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else files.push(arg);
  }

  return { write, check, json, stdin, stdinFilepath, files };
}

function printHelp(): void {
  console.log(
    [
      'ai-code-cleaner [archivos...] [--write] [--check] [--json]',
      'ai-code-cleaner --stdin --stdin-filepath <ruta> < entrada > salida',
      '',
      'Elimina comentarios de ruido de IA sin tocar la lógica del código.',
      '',
      '  (sin flags)        modo dry-run: reporta qué se eliminaría, no toca nada.',
      '  --write            aplica los cambios al archivo.',
      '  --check            no toca nada; termina con código 1 si algún archivo cambiaría',
      '                     (para usar en CI).',
      '  --json             imprime un reporte JSON en vez de texto (para integraciones).',
      '  --stdin            lee el código de stdin y escribe el resultado en stdout; nunca',
      '                     escribe nada más en stdout (diagnósticos van a stderr). Requiere',
      '                     --stdin-filepath. Pensado para usarse como formatter externo',
      '                     desde otros editores (Neovim, JetBrains, Sublime...).',
      '  --stdin-filepath   ruta (real o ficticia) que decide qué lenguaje usar con --stdin.',
    ].join('\n'),
  );
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Modo formatter: lee de stdin, escribe en stdout. stdout nunca lleva nada que
 * no sea el código resultante — cualquier diagnóstico va a stderr — porque un
 * editor que lo use como formatter externo toma stdout literal como el nuevo
 * contenido del buffer. Ante duda (error de sintaxis, extensión no soportada)
 * se devuelve la entrada tal cual: un formatter externo debe ser siempre
 * seguro de encadenar, nunca debe dejar el buffer vacío o corrompido.
 */
async function runStdin(stdinFilepath: string): Promise<void> {
  const ext = extensionOf(stdinFilepath);
  const adapter = adapterForExtension(ext);
  const input = await readStdin();

  if (!adapter) {
    console.error(`ai-code-cleaner: "${stdinFilepath}" no está soportado (extensión "${ext}").`);
    process.stdout.write(input);
    return;
  }

  const result = await clean(input, adapter);
  process.stdout.write(result.abstained ? input : result.output);
}

async function processFile(file: string, options: Options): Promise<FileResult> {
  const ext = extensionOf(file);
  const adapter = adapterForExtension(ext);
  if (!adapter) {
    return { file, status: 'unsupported', noiseCount: 0, applied: false, error: null };
  }

  let originalText: string;
  try {
    originalText = readFileSync(file, 'utf8');
  } catch (err) {
    return { file, status: 'error', noiseCount: 0, applied: false, error: (err as Error).message };
  }

  const result = await clean(originalText, adapter);

  if (result.abstained) {
    return { file, status: 'abstained', noiseCount: 0, applied: false, error: null };
  }

  if (result.edits.length === 0) {
    return { file, status: 'unchanged', noiseCount: 0, applied: false, error: null };
  }

  let applied = false;
  if (options.write) {
    writeFileSync(file, result.output, 'utf8');
    applied = true;
  }

  return { file, status: 'changed', noiseCount: result.edits.length, applied, error: null };
}

function printHuman(result: FileResult): void {
  switch (result.status) {
    case 'unsupported':
      console.error(`ai-code-cleaner: "${result.file}" no está soportado.`);
      return;
    case 'error':
      console.error(`ai-code-cleaner: no se pudo leer "${result.file}": ${result.error}`);
      return;
    case 'abstained':
      console.log(`${result.file}: errores de sintaxis — no se tocó nada por seguridad.`);
      return;
    case 'unchanged':
      console.log(`${result.file}: sin comentarios de ruido.`);
      return;
    case 'changed':
      console.log(`${result.file}: ${result.noiseCount} comentario(s) de ruido detectado(s).`);
      if (result.applied) console.log(`${result.file}: aplicado.`);
  }
}

async function runFiles(options: Options): Promise<void> {
  if (options.files.length === 0) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const results: FileResult[] = [];
  for (const file of options.files) {
    results.push(await processFile(file, options));
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) printHuman(result);
  }

  const anyWouldChange = results.some((r) => r.status === 'changed');
  const anyError = results.some((r) => r.status === 'error' || r.status === 'unsupported');

  if (options.check && anyWouldChange) {
    process.exitCode = 1;
  } else if (anyError) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.stdin) {
    if (!options.stdinFilepath) {
      console.error('ai-code-cleaner: --stdin requiere --stdin-filepath <ruta>.');
      process.exitCode = 1;
      return;
    }
    await runStdin(options.stdinFilepath);
    return;
  }

  await runFiles(options);
}

main().catch((err) => {
  console.error('ai-code-cleaner: error inesperado', err);
  process.exitCode = 1;
});
