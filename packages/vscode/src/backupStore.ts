import type * as vscode from 'vscode';

/**
 * Guarda, por archivo, el texto de justo antes del último cambio aplicado por
 * AI Code Cleaner (comando manual, selección o modo live con autoApply). Es un
 * "deshacer rápido" de un solo nivel, complementario al Ctrl+Z nativo de VS Code
 * (que sigue funcionando igual) — pensado para el caso de "aplicué sin querer,
 * quiero volver exactamente a como estaba antes de que la extensión tocara nada".
 */
const backups = new Map<string, string>();

export function saveBackup(uri: vscode.Uri, text: string): void {
  backups.set(uri.toString(), text);
}

export function takeBackup(uri: vscode.Uri): string | undefined {
  return backups.get(uri.toString());
}

export function clearBackup(uri: vscode.Uri): void {
  backups.delete(uri.toString());
}
