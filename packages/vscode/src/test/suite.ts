import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

/**
 * Suite mínima que corre dentro de un VS Code real (Extension Development Host,
 * vía @vscode/test-electron) para verificar el camino feliz de UI: la extensión
 * activa, el comando "Preview Changes" corre el motor real sobre un archivo con
 * ruido de IA de verdad, y se abre una vista de diff — no solo que el código
 * compile o que el motor puro pase sus fixtures.
 */
export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension('ai-code-cleaner.ai-code-cleaner-vscode');
  assert.ok(ext, 'la extensión debería estar registrada');
  await ext?.activate();

  const tmpFile = path.join(os.tmpdir(), `ai-code-cleaner-e2e-${Date.now()}.ts`);
  fs.writeFileSync(
    tmpFile,
    [
      '// Verificar si el usuario existe',
      'const user = getUser(1);',
      '',
      'export { user };',
      '',
    ].join('\n'),
    'utf8',
  );

  try {
    const document = await vscode.workspace.openTextDocument(tmpFile);
    await vscode.window.showTextDocument(document);

    await vscode.commands.executeCommand('aiCodeCleaner.previewChanges');
    // Dar tiempo a que el editor de diff termine de abrirse.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const openTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
    const diffTab = openTabs.find((tab) => tab.label.includes('AI Code Cleaner'));
    assert.ok(
      diffTab,
      `debería haber una pestaña de diff titulada "AI Code Cleaner: ..."; pestañas abiertas: ${openTabs
        .map((t) => t.label)
        .join(', ')}`,
    );
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}
