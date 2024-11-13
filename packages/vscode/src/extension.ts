import { Formatter, Linter, Parser } from "@fatduckai/ai";
import * as vscode from "vscode";

let diagnosticCollection: vscode.DiagnosticCollection;
let decorationTypes: {
  [key: string]: vscode.TextEditorDecorationType;
};

export function activate(context: vscode.ExtensionContext) {
  console.log("DucksInARow extension is now active");

  // Create diagnostic collection
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("ducksinarow");

  // Register decoration types
  decorationTypes = {
    block: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor("ducksinarow.block"),
      fontWeight: "bold",
    }),
    variable: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor("ducksinarow.variable"),
      fontStyle: "italic",
    }),
    gen: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor("ducksinarow.gen"),
      backgroundColor: new vscode.ThemeColor("ducksinarow.genBackground"),
    }),
    system: vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor("ducksinarow.systemBackground"),
      isWholeLine: true,
    }),
  };

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("ducksinarow.format", formatDocument),
    vscode.commands.registerCommand("ducksinarow.analyze", analyzeDocument),
    vscode.commands.registerCommand(
      "ducksinarow.previewTemplate",
      previewTemplate
    )
  );

  // Register providers
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "ducksinarow",
      new PromptCompletionProvider(),
      "{",
      "#",
      "/"
    ),
    vscode.languages.registerHoverProvider(
      "ducksinarow",
      new PromptHoverProvider()
    ),
    vscode.languages.registerDocumentFormattingEditProvider(
      "ducksinarow",
      new PromptFormattingProvider()
    ),
    vscode.languages.registerCodeActionsProvider(
      "ducksinarow",
      new PromptCodeActionProvider(),
      {
        providedCodeActionKinds: [
          vscode.CodeActionKind.QuickFix,
          vscode.CodeActionKind.Refactor,
        ],
      }
    )
  );

  // Setup document change listeners
  setupChangeListeners(context);
}

// Completion Provider
class PromptCompletionProvider implements vscode.CompletionItemProvider {
  private blockTypes = [
    "system",
    "user",
    "assistant",
    "if",
    "select",
    "gen",
    "each",
    "include",
  ];

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    const linePrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    // Block completion
    if (linePrefix.endsWith("{{#")) {
      return this.blockTypes.map((type) => {
        const item = new vscode.CompletionItem(
          type,
          vscode.CompletionItemKind.Snippet
        );
        item.insertText = new vscode.SnippetString(`${type}}}$0{{/${type}}}`);
        return item;
      });
    }

    // Variable completion
    const template = Parser.parse(document.getText());
    return Array.from(template.variables).map((variable) => {
      const item = new vscode.CompletionItem(
        variable,
        vscode.CompletionItemKind.Variable
      );
      item.insertText = new vscode.SnippetString(`{{${variable}}}`);
      return item;
    });
  }
}

// Hover Provider
class PromptHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | null {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return null;

    const word = document.getText(range);

    // Block documentation
    if (word.match(/^(system|user|assistant|if|select|gen|each|include)$/)) {
      return new vscode.Hover([
        new vscode.MarkdownString(`**${word}** block`),
        this.getBlockDocumentation(word),
      ]);
    }

    return null;
  }

  private getBlockDocumentation(blockType: string): vscode.MarkdownString {
    const docs: Record<string, string> = {
      system: "Defines system-level instructions and context",
      user: "Represents user input or context",
      assistant: "Defines assistant responses",
      if: "Conditional block for template logic",
      select: "Creates a selection from multiple options",
      gen: "Generates content using the LLM",
      each: "Iterates over a collection",
      include: "Includes another template",
    };

    return new vscode.MarkdownString(docs[blockType] || "");
  }
}

// Formatting Provider
class PromptFormattingProvider
  implements vscode.DocumentFormattingEditProvider
{
  provideDocumentFormattingEdits(
    document: vscode.TextDocument
  ): vscode.TextEdit[] {
    const text = document.getText();
    const formatted = Formatter.format(text);

    return [
      vscode.TextEdit.replace(
        new vscode.Range(
          document.positionAt(0),
          document.positionAt(text.length)
        ),
        formatted
      ),
    ];
  }
}

// Code Action Provider
class PromptCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Add system block if missing
    if (!document.getText().includes("{{#system}}")) {
      const action = new vscode.CodeAction(
        "Add system block",
        vscode.CodeActionKind.QuickFix
      );
      action.edit = new vscode.WorkspaceEdit();
      action.edit.insert(
        document.uri,
        new vscode.Position(0, 0),
        "{{#system}}\nYou are a helpful assistant.\n{{/system}}\n\n"
      );
      actions.push(action);
    }

    return actions;
  }
}

// Update decorations on document change
function setupChangeListeners(context: vscode.ExtensionContext) {
  let decorationTimer: ReturnType<typeof setTimeout> | undefined;

  function triggerUpdateDecorations(editor: vscode.TextEditor) {
    if (decorationTimer) {
      clearTimeout(decorationTimer);
    }
    decorationTimer = setTimeout(() => updateDecorations(editor), 300);
  }

  // Register update triggers
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) triggerUpdateDecorations(editor);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        triggerUpdateDecorations(editor);
      }
    })
  );

  // Initial update
  if (vscode.window.activeTextEditor) {
    triggerUpdateDecorations(vscode.window.activeTextEditor);
  }
}

// Update decorations and diagnostics
async function updateDecorations(editor: vscode.TextEditor) {
  const text = editor.document.getText();
  const config = vscode.workspace.getConfiguration("ducksinarow");

  try {
    // Parse template
    const template = Parser.parse(text);

    // Get diagnostics
    const linter = new Linter();
    const suggestions = await linter.lint(template);

    // Update diagnostics
    const diagnostics = suggestions.map((suggestion) => {
      const range = new vscode.Range(
        suggestion.line - 1,
        suggestion.column - 1,
        suggestion.line - 1,
        suggestion.column + 10
      );

      return new vscode.Diagnostic(
        range,
        suggestion.message,
        toVSCodeSeverity(suggestion.severity)
      );
    });

    diagnosticCollection.set(editor.document.uri, diagnostics);

    // Update decorations
    updateSyntaxHighlighting(editor, template);
  } catch (error) {
    console.error("Error updating decorations:", error);
  }
}

// Update syntax highlighting
function updateSyntaxHighlighting(editor: vscode.TextEditor, template: any) {
  const blockDecorations: vscode.DecorationOptions[] = [];
  const variableDecorations: vscode.DecorationOptions[] = [];
  const genDecorations: vscode.DecorationOptions[] = [];
  const systemDecorations: vscode.DecorationOptions[] = [];

  // Find all blocks
  const text = editor.document.getText();
  let match;

  // Block decorations
  const blockRegex = /{{#(\w+)}}|{{\/\w+}}/g;
  while ((match = blockRegex.exec(text))) {
    const startPos = editor.document.positionAt(match.index);
    const endPos = editor.document.positionAt(match.index + match[0].length);
    blockDecorations.push({ range: new vscode.Range(startPos, endPos) });

    // Special handling for system blocks
    if (match[1] === "system") {
      const blockEnd = text.indexOf("{{/system}}", match.index);
      if (blockEnd !== -1) {
        const blockRange = new vscode.Range(
          editor.document.positionAt(match.index),
          editor.document.positionAt(blockEnd + 12)
        );
        systemDecorations.push({ range: blockRange });
      }
    }
  }

  // Variable decorations
  const varRegex = /{{(\w+)}}/g;
  while ((match = varRegex.exec(text))) {
    if (!match[1].startsWith("#") && !match[1].startsWith("/")) {
      const startPos = editor.document.positionAt(match.index);
      const endPos = editor.document.positionAt(match.index + match[0].length);
      variableDecorations.push({ range: new vscode.Range(startPos, endPos) });
    }
  }

  // Gen block decorations
  const genRegex = /{{gen\s+'[^']*'}}/g;
  while ((match = genRegex.exec(text))) {
    const startPos = editor.document.positionAt(match.index);
    const endPos = editor.document.positionAt(match.index + match[0].length);
    genDecorations.push({ range: new vscode.Range(startPos, endPos) });
  }

  // Apply decorations
  editor.setDecorations(decorationTypes.block, blockDecorations);
  editor.setDecorations(decorationTypes.variable, variableDecorations);
  editor.setDecorations(decorationTypes.gen, genDecorations);
  editor.setDecorations(decorationTypes.system, systemDecorations);
}

// Format document command
async function formatDocument() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const text = editor.document.getText();
  const formatted = Formatter.format(text);

  editor.edit((editBuilder) => {
    const fullRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(text.length)
    );
    editBuilder.replace(fullRange, formatted);
  });
}

// Analyze document command
async function analyzeDocument() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const text = editor.document.getText();
  const template = Parser.parse(text);

  // Show analysis in new editor
  const doc = await vscode.workspace.openTextDocument({
    content: JSON.stringify(template, null, 2),
    language: "json",
  });

  await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.Beside,
  });
}

// Preview template command
async function previewTemplate() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const panel = vscode.window.createWebviewPanel(
    "templatePreview",
    "Template Preview",
    vscode.ViewColumn.Beside,
    {}
  );

  const template = Parser.parse(editor.document.getText());
  panel.webview.html = getPreviewHtml(template);
}

// Helper function to convert severity
function toVSCodeSeverity(severity: string): vscode.DiagnosticSeverity {
  switch (severity) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "suggestion":
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Hint;
  }
}

// Helper function for preview HTML
function getPreviewHtml(template: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: system-ui; padding: 20px; }
          .block { margin: 10px 0; padding: 10px; border-radius: 4px; }
          .system { background: #f0f0f0; }
          .user { background: #e3f2fd; }
          .assistant { background: #f1f8e9; }
          .variable { color: #1976d2; font-style: italic; }
          .gen { color: #2e7d32; font-weight: bold; }
        </style>
      </head>
      <body>
        ${renderTemplate(template)}
      </body>
    </html>
  `;
}

// Helper function to render template preview
function renderTemplate(template: any): string {
  let html = "";
  for (const block of template.blocks) {
    html += `
      <div class="block ${block.type}">
        <strong>${block.type}</strong>
        <div>${highlightContent(block.content)}</div>
      </div>
    `;
  }
  return html;
}

// Helper function to highlight content
function highlightContent(content: string): string {
  return content
    .replace(/{{(\w+)}}/g, '<span class="variable">{{$1}}</span>')
    .replace(/{{gen\s+'[^']*'}}/g, '<span class="gen">$&</span>');
}

// Deactivate extension
export function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }

  Object.values(decorationTypes).forEach((type) => type.dispose());
}
