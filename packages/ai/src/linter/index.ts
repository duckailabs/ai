import { LintResult, type Block, type ParsedTemplate } from "../types.js";

export class Linter {
  async lint(template: ParsedTemplate): Promise<LintResult[]> {
    const results: LintResult[] = [];

    const [systemPromptResults, variableResults, nestedGenResults] =
      await Promise.all([
        this.checkSystemPrompt(template),
        this.checkUndefinedVariables(template),
        this.checkNestedGenBlocks(template.blocks),
      ]);

    return [...systemPromptResults, ...variableResults, ...nestedGenResults];
  }

  private checkSystemPrompt(template: ParsedTemplate): LintResult[] {
    const results: LintResult[] = [];
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
    return results;
  }

  private checkUndefinedVariables(template: ParsedTemplate): LintResult[] {
    const results: LintResult[] = [];
    const definedVars = new Set();

    template.blocks.forEach((block) => {
      if (block.variables) {
        Object.keys(block.variables).forEach((v) => definedVars.add(v));
      }
    });

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

  private checkNestedGenBlocks(blocks: Block[]): LintResult[] {
    const results: LintResult[] = [];
    const checkBlock = (block: Block) => {
      if (!block.children?.length) return;

      const hasGenBlock = block.content.includes("<gen");
      const hasNestedGen = block.children.some((child) =>
        child.content.includes("<gen")
      );

      if (hasGenBlock && hasNestedGen) {
        results.push({
          message: "Avoid nesting gen blocks inside each other",
          severity: "warning",
          line: this.findBlockLocation(block, block.range?.start || 0),
          column: 1,
        });
      }

      block.children.forEach(checkBlock);
    };

    blocks.forEach(checkBlock);
    return results;
  }

  private findVariableLocation(variable: string, content: string): number {
    const match = new RegExp(`<${variable}>`, "g").exec(content);
    if (!match) return 1;
    return (content.slice(0, match.index).match(/\n/g) || []).length + 1;
  }

  private findBlockLocation(block: Block, offset: number): number {
    return (block.content.slice(0, offset).match(/\n/g) || []).length + 1;
  }
}
