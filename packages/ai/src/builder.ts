import { Linter } from "./linter";
import { Parser } from "./parser";
import type { ChatMessage, Role } from "./types";

interface PromptBuilderOptions {
  validateOnBuild?: boolean;
  throwOnWarnings?: boolean;
  allowEmptyContent?: boolean;
}

export class PromptBuilder {
  private template: string;
  private context: Record<string, any> = {};
  private readonly linter: Linter;
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
    Object.entries(context).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        throw new Error(
          `Context value for "${key}" cannot be undefined or null`
        );
      }
    });

    this.context = { ...this.context, ...context };
    return this;
  }

  async validate() {
    try {
      const parsed = Parser.parse(this.template);
      const lintResults = await this.linter.lint(parsed);

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

  async build(): Promise<ChatMessage[]> {
    try {
      if (this.options.validateOnBuild) {
        const validation = await this.validate();

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
        .filter((block) => block.type !== "text") // Filter out text blocks
        .map((block) => {
          let content = block.content;

          // Replace variables
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
            role: block.type as Role, // Type assertion is safe because we filtered out 'text'
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
