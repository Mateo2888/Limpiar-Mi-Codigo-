import { clean } from '@ai-code-cleaner/core';
import { createTypeScriptAdapter } from '@ai-code-cleaner/lang-typescript';
import * as vscode from 'vscode';

const PREVIEW_SCHEME = 'ai-code-cleaner-preview';

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot);
}

/**
 * Sirve el contenido "propuesto" (ya limpio) como un documento virtual de solo
 * lectura, para poder mostrarlo con el diff nativo de VS Code sin tocar el
 * archivo real hasta que el usuario decida aplicar los cambios.
 */
class PreviewContentProvider implements vscode.TextDocumentContentProvider {
  private readonly contents = new Map<string, string>();
  private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.changeEmitter.event;

  set(uri: vscode.Uri, content: string): void {
    this.contents.set(uri.toString(), content);
    this.changeEmitter.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? '';
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const previewProvider = new PreviewContentProvider();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, previewProvider),
    vscode.commands.registerCommand('aiCodeCleaner.previewChanges', () =>
      runCleaner(previewProvider, { offerApply: false }),
    ),
    vscode.commands.registerCommand('aiCodeCleaner.cleanCurrentFile', () =>
      runCleaner(previewProvider, { offerApply: true }),
    ),
  );
}

export function deactivate(): void {}

async function runCleaner(
  previewProvider: PreviewContentProvider,
  options: { offerApply: boolean },
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('AI Code Cleaner: no hay ningún archivo abierto.');
    return;
  }

  const document = editor.document;
  const ext = extensionOf(document.fileName);
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    void vscode.window.showWarningMessage(
      `AI Code Cleaner: "${ext || document.fileName}" todavía no está soportado (por ahora solo JS/TS).`,
    );
    return;
  }

  const originalText = document.getText();
  const adapter = createTypeScriptAdapter(ext);
  const result = await clean(originalText, adapter);

  if (result.abstained) {
    void vscode.window.showWarningMessage(
      'AI Code Cleaner: el archivo tiene errores de sintaxis; no se tocó nada por seguridad.',
    );
    return;
  }

  if (result.edits.length === 0) {
    void vscode.window.showInformationMessage(
      'AI Code Cleaner: no se encontraron comentarios de ruido.',
    );
    return;
  }

  const previewUri = vscode.Uri.parse(
    `${PREVIEW_SCHEME}:${document.fileName}?ai-code-cleaner-preview`,
  );
  previewProvider.set(previewUri, result.output);

  const fileLabel = document.fileName.split(/[/\\]/).pop();
  await vscode.commands.executeCommand(
    'vscode.diff',
    document.uri,
    previewUri,
    `AI Code Cleaner: ${fileLabel} (${result.edits.length} comentario(s) a eliminar)`,
  );

  if (!options.offerApply) return;

  const choice = await vscode.window.showInformationMessage(
    `Se detectaron ${result.edits.length} comentario(s) de ruido. ¿Aplicar los cambios?`,
    'Aplicar',
    'Descartar',
  );
  if (choice !== 'Aplicar') return;

  // El documento pudo cambiar mientras se mostraba el diff; releer antes de aplicar
  // y abstenerse si ya no coincide, para no pisar ediciones nuevas del usuario.
  if (document.getText() !== originalText) {
    void vscode.window.showWarningMessage(
      'AI Code Cleaner: el archivo cambió mientras se mostraba la vista previa; vuelve a intentarlo.',
    );
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(originalText.length),
  );
  edit.replace(document.uri, fullRange, result.output);
  await vscode.workspace.applyEdit(edit);
}
