import { LintResult, ParsedTemplate } from "./types";
export class Linter {
  async lint(template: ParsedTemplate): Promise<LintResult[]> {
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

    // Check undefined variables
    const definedVars = new Set();
    template.blocks.forEach((block) => {
      if (block.variables) {
        Object.keys(block.variables).forEach((v) => definedVars.add(v));
      }
    });

    // Find any undefined variables
    template.variables.forEach((variable) => {
      if (!definedVars.has(variable)) {
        const line = this.findVariableLocation(variable, template.raw);
        results.push({
          message: `Variable "${variable}" is used but not defined`,
          severity: "error",
          line,
          column: 1,
        });
      }
    });

    return results;
  }

  private findVariableLocation(variable: string, content: string): number {
    const match = new RegExp(`<${variable}>`, "g").exec(content);
    if (!match) return 1;
    return (content.slice(0, match.index).match(/\n/g) || []).length + 1;
  }
}
