import { LintResult, ParsedTemplate } from "./types";
export class Linter {
  constructor(private context: Record<string, any> = {}) {}

  lint(template: ParsedTemplate): LintResult[] {
    const results: LintResult[] = [];

    // Check system prompt
    const hasSystemPrompt = template.blocks.some(
      (block) => block.type === "system"
    );
    if (!hasSystemPrompt) {
      results.push({
        message: "Template should start with a system prompt",
        severity: "warning",
        line: 1,
        column: 1,
      });
    }

    // Check for undefined variables by comparing against context
    const missingVariables = template.variables.filter(
      (variable) => !(variable in this.context)
    );

    if (missingVariables.length > 0) {
      results.push({
        message: `Required variables not provided: ${missingVariables.join(
          ", "
        )}`,
        severity: "error",
        line: 1,
        column: 1,
      });
    }

    return results;
  }

  private findVariableLocation(variable: string, content: string): number {
    const match = new RegExp(`<${variable}>`, "g").exec(content);
    if (!match) return 1;
    return (content.slice(0, match.index).match(/\n/g) || []).length + 1;
  }
}
