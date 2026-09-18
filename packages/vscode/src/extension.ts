import { clean } from '@ai-code-cleaner/core';
import { adapterForExtension, extensionOf } from '@ai-code-cleaner/registry';
import * as vscode from 'vscode';
import { clearBackup, saveBackup, takeBackup } from './backupStore.js';
import { LiveWatcher } from './liveWatcher.js';

const PREVIEW_SCHEME = 'ai-code-cleaner-preview';

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
      runCleanFile(previewProvider, { offerApply: false }),
    ),
    vscode.commands.registerCommand('aiCodeCleaner.cleanCurrentFile', () =>
      runCleanFile(previewProvider, { offerApply: true }),
    ),
    vscode.commands.registerCommand('aiCodeCleaner.cleanSelection', () => runCleanSelection()),
    vscode.commands.registerCommand('aiCodeCleaner.restore', () => runRestore()),
  );

  new LiveWatcher().register(context);
}

export function deactivate(): void {}

function requireSupportedEditor(): { editor: vscode.TextEditor; ext: string } | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('AI Code Cleaner: no hay ningún archivo abierto.');
    return null;
  }
  const ext = extensionOf(editor.document.fileName);
  if (!adapterForExtension(ext)) {
    void vscode.window.showWarningMessage(
      `AI Code Cleaner: "${ext || editor.document.fileName}" todavía no está soportado (por ahora JS/TS/Python).`,
    );
    return null;
  }
  return { editor, ext };
}

async function runCleanFile(
  previewProvider: PreviewContentProvider,
  options: { offerApply: boolean },
): Promise<void> {
  const found = requireSupportedEditor();
  if (!found) return;
  const { editor, ext } = found;
  const document = editor.document;
  const adapter = adapterForExtension(ext);
  if (!adapter) return;

  const originalText = document.getText();
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

  saveBackup(document.uri, originalText);
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(originalText.length),
  );
  edit.replace(document.uri, fullRange, result.output);
  await vscode.workspace.applyEdit(edit);
}

/**
 * Igual que `Clean Current File`, pero solo toca los comentarios de ruido que caen
 * dentro de la selección actual. Sigue parseando el archivo completo (necesita el
 * contexto real para detectar errores de sintaxis y para que el core razone sobre
 * el árbol de verdad), pero solo aplica las ediciones que intersectan la selección.
 */
async function runCleanSelection(): Promise<void> {
  const found = requireSupportedEditor();
  if (!found) return;
  const { editor, ext } = found;
  const document = editor.document;
  const selection = editor.selection;

  if (selection.isEmpty) {
    void vscode.window.showWarningMessage(
      'AI Code Cleaner: selecciona primero el código a limpiar.',
    );
    return;
  }

  const adapter = adapterForExtension(ext);
  if (!adapter) return;

  const originalText = document.getText();
  const result = await clean(originalText, adapter);

  if (result.abstained) {
    void vscode.window.showWarningMessage(
      'AI Code Cleaner: el archivo tiene errores de sintaxis; no se tocó nada por seguridad.',
    );
    return;
  }

  const selStart = document.offsetAt(selection.start);
  const selEnd = document.offsetAt(selection.end);
  const editsInSelection = result.edits.filter(
    (e) => e.range.startByte < selEnd && selStart < e.range.endByte,
  );

  if (editsInSelection.length === 0) {
    void vscode.window.showInformationMessage(
      'AI Code Cleaner: no se encontraron comentarios de ruido en la selección.',
    );
    return;
  }

  saveBackup(document.uri, originalText);
  const workspaceEdit = new vscode.WorkspaceEdit();
  for (const e of editsInSelection) {
    workspaceEdit.replace(
      document.uri,
      new vscode.Range(
        document.positionAt(e.range.startByte),
        document.positionAt(e.range.endByte),
      ),
      e.replacement,
    );
  }
  await vscode.workspace.applyEdit(workspaceEdit);
}

async function runRestore(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('AI Code Cleaner: no hay ningún archivo abierto.');
    return;
  }

  const document = editor.document;
  const backup = takeBackup(document.uri);
  if (backup === undefined) {
    void vscode.window.showWarningMessage(
      'AI Code Cleaner: no hay ningún cambio de AI Code Cleaner que deshacer en este archivo (usa Ctrl+Z para otros cambios).',
    );
    return;
  }

  const currentText = document.getText();
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(currentText.length),
  );
  edit.replace(document.uri, fullRange, backup);
  await vscode.workspace.applyEdit(edit);
  clearBackup(document.uri);
}
