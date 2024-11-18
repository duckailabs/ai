import { Linter } from "./linter";
import { Parser } from "./parser";
import type { Block, ChatMessage } from "./types";

interface PromptBuilderOptions {
  validateOnBuild?: boolean;
  throwOnWarnings?: boolean;
  allowEmptyContent?: boolean;
}

export class PromptBuilder {
  private template: string;
  private context: Record<string, any> = {};
  private linter: Linter;
  private readonly options: Required<PromptBuilderOptions>;

  constructor(template: string, options: PromptBuilderOptions = {}) {
    this.template = template;
    this.linter = new Linter();

    this.options = {
      validateOnBuild: true,
      throwOnWarnings: false,
      allowEmptyContent: false,
      ...options,
    };
  }

  withContext(context: Record<string, any>): this {
    // Don't validate values if allowEmptyContent is true
    if (!this.options.allowEmptyContent) {
      Object.entries(context).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === null ||
          value.toString().trim() === ""
        ) {
          throw new Error(
            `Empty content not allowed for "${key}". Set allowEmptyContent to true to allow empty, null, or undefined values.`
          );
        }
      });
    }

    this.context = { ...this.context, ...context };
    this.linter = new Linter(this.context, this.options.allowEmptyContent);
    return this;
  }

  validate() {
    try {
      const parsed = Parser.parse(this.template);
      const lintResults = this.linter.lint(parsed);

      return {
        isValid: !lintResults.some((r) => r.severity === "error"),
        errors: lintResults
          .filter((r) => r.severity === "error")
          .map((e) => `Line ${e.line}: ${e.message}`),
        warnings: lintResults
          .filter((r) => r.severity === "warning")
          .map((w) => `Line ${w.line}: ${w.message}`),
        info: lintResults
          .filter((r) => r.severity === "info")
          .map((i) => `Line ${i.line}: ${i.message}`),
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        info: [],
      };
    }
  }

  build(): ChatMessage[] {
    try {
      if (this.options.validateOnBuild) {
        const validation = this.validate();
        if (!validation.isValid) {
          throw new Error(
            `Template validation failed:\n${validation.errors.join("\n")}`
          );
        }
        if (this.options.throwOnWarnings && validation.warnings.length > 0) {
          throw new Error(
            `Template has warnings:\n${validation.warnings.join("\n")}`
          );
        }
      }

      const parsed = Parser.parse(this.template);

      return parsed.blocks
        .filter(
          (block): block is Block =>
            block.type === "system" ||
            block.type === "user" ||
            block.type === "assistant"
        )
        .map((block) => {
          let content = block.content;

          // Replace variables, converting undefined/null to empty string if allowEmptyContent is true
          Object.entries(this.context).forEach(([key, value]) => {
            const regex = new RegExp(`<${key}>`, "g");
            const replacement =
              value === undefined || value === null ? "" : String(value);
            content = content.replace(regex, replacement);
          });

          if (!content.trim() && !this.options.allowEmptyContent) {
            throw new Error(
              `Empty content in ${block.type} block after variable replacement`
            );
          }

          const message: ChatMessage = {
            role: block.type,
            content: content.trim(),
          };

          if (block.name) {
            message.name = block.name;
          }

          return message;
        });
    } catch (error) {
      throw new Error(
        `Failed to build prompt: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
