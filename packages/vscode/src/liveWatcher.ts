import { clean } from '@ai-code-cleaner/core';
import * as vscode from 'vscode';
import { adapterForExtension, extensionOf } from './adapters.js';

const DEBOUNCE_MS = 600;
const REMOVE_SUGGESTION_COMMAND = 'aiCodeCleaner.removeSuggestedComment';

interface PendingSuggestion {
  range: vscode.Range;
}

function config() {
  return vscode.workspace.getConfiguration('aiCodeCleaner');
}

/**
 * Modo automático: mientras se escribe, sugiere (no borra en silencio, salvo que
 * el usuario active `autoApply`) eliminar un comentario de ruido justo después de
 * escribirlo. Reanaliza el documento completo con el motor real tras un debounce,
 * y solo muestra sugerencias para lo que el core ya habría marcado — nunca decide
 * nada por su cuenta, distinto de correr `clean()` manualmente.
 */
export class LiveWatcher implements vscode.CodeLensProvider {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changeEmitter.event;

  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly suggestions = new Map<string, PendingSuggestion[]>();

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ pattern: '**/*' }, this),
      vscode.workspace.onDidChangeTextDocument((event) => this.onChange(event)),
      vscode.workspace.onDidCloseTextDocument((document) =>
        this.suggestions.delete(document.uri.toString()),
      ),
      vscode.commands.registerCommand(
        REMOVE_SUGGESTION_COMMAND,
        (uri: vscode.Uri, range: vscode.Range) => this.applyRemoval(uri, range),
      ),
    );
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const pending = this.suggestions.get(document.uri.toString());
    if (!pending || pending.length === 0) return [];
    return pending.map(
      (p) =>
        new vscode.CodeLens(p.range, {
          title: '💡 Comentario redundante — Eliminar',
          command: REMOVE_SUGGESTION_COMMAND,
          arguments: [document.uri, p.range],
        }),
    );
  }

  private onChange(event: vscode.TextDocumentChangeEvent): void {
    if (event.contentChanges.length === 0) return;
    if (!config().get<boolean>('liveMode.enabled', true)) return;
    if (!adapterForExtension(extensionOf(event.document.fileName))) return;

    const key = event.document.uri.toString();
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        void this.analyze(event.document);
      }, DEBOUNCE_MS),
    );
  }

  private async analyze(document: vscode.TextDocument): Promise<void> {
    const adapter = adapterForExtension(extensionOf(document.fileName));
    if (!adapter) return;

    const key = document.uri.toString();
    const text = document.getText();
    const result = await clean(text, adapter);

    if (result.abstained || result.edits.length === 0) {
      this.suggestions.delete(key);
      this.changeEmitter.fire();
      return;
    }

    if (config().get<boolean>('liveMode.autoApply', false)) {
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
      edit.replace(document.uri, fullRange, result.output);
      await vscode.workspace.applyEdit(edit);
      this.suggestions.delete(key);
      this.changeEmitter.fire();
      return;
    }

    this.suggestions.set(
      key,
      result.edits.map((e) => ({
        range: new vscode.Range(
          document.positionAt(e.range.startByte),
          document.positionAt(e.range.endByte),
        ),
      })),
    );
    this.changeEmitter.fire();
  }

  private async applyRemoval(uri: vscode.Uri, range: vscode.Range): Promise<void> {
    const key = uri.toString();
    const pending = this.suggestions.get(key);
    // Si el documento cambió desde que se generó la sugerencia, este rango ya no
    // es de fiar — abstenerse en vez de borrar algo que ya no es lo sugerido.
    const stillPending = pending?.some((p) => p.range.isEqual(range));
    if (!pending || !stillPending) return;

    const edit = new vscode.WorkspaceEdit();
    edit.delete(uri, range);
    await vscode.workspace.applyEdit(edit);

    this.suggestions.set(
      key,
      pending.filter((p) => !p.range.isEqual(range)),
    );
    this.changeEmitter.fire();
  }
}
