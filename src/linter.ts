import type { LintResult, ParsedTemplate } from "./types.js";
export class Linter {
  constructor(
    private context: Record<string, any> = {},
    private allowEmptyContent: boolean = false
  ) {}

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

    // Check variables
    template.variables.forEach((variable) => {
      if (!(variable in this.context)) {
        results.push({
          message: `Required variable not provided: ${variable}`,
          severity: "error",
          line: this.findVariableLocation(variable, template.raw),
          column: 1,
        });
      } else if (!this.allowEmptyContent) {
        const value = this.context[variable];
        if (
          value === undefined ||
          value === null ||
          value.toString().trim() === ""
        ) {
          results.push({
            message: `Empty content not allowed for variable: ${variable}`,
            severity: "error",
            line: this.findVariableLocation(variable, template.raw),
            column: 1,
          });
        }
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
