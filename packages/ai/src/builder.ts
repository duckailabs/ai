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
    this.linter = new Linter(this.context);

    this.options = {
      validateOnBuild: true,
      throwOnWarnings: false,
      allowEmptyContent: false,
      ...options,
    };
  }

  withContext(context: Record<string, any>): this {
    Object.entries(context).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        throw new Error(
          `Context value for "${key}" cannot be undefined or null`
        );
      }
    });

    this.context = { ...this.context, ...context };
    this.linter = new Linter(this.context); // Update linter with new context
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
      // Still validate but don't throw
      if (this.options.validateOnBuild) {
        const validation = this.validate();

        // Only throw if throwOnWarnings is true and we have warnings
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

          // Replace variables that exist in context, leave others as is
          Object.entries(this.context).forEach(([key, value]) => {
            const regex = new RegExp(`<${key}>`, "g");
            content = content.replace(regex, String(value));
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
      // Instead of throwing, return the blocks with unreplaced variables
      const parsed = Parser.parse(this.template);
      return parsed.blocks
        .filter(
          (block): block is Block =>
            block.type === "system" ||
            block.type === "user" ||
            block.type === "assistant"
        )
        .map((block) => ({
          role: block.type,
          content: block.content.trim(),
          ...(block.name ? { name: block.name } : {}),
        }));
    }
  }
}
