import { Linter } from "./linter";
import { Parser } from "./parser";

interface PromptBuilderOptions {
  validateOnBuild?: boolean;
  throwOnWarnings?: boolean;
}

export class PromptBuilder {
  private template: string;
  private context: Record<string, any> = {};
  private linter: Linter;
  private options: PromptBuilderOptions;

  constructor(template: string, options: PromptBuilderOptions = {}) {
    this.template = template;
    this.linter = new Linter();
    this.options = {
      validateOnBuild: true,
      throwOnWarnings: false,
      ...options,
    };
  }

  withContext(context: Record<string, any>): this {
    this.context = { ...this.context, ...context };
    return this;
  }

  async validate(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const parsed = Parser.parse(this.template);
      const lintResults = await this.linter.lint(parsed);

      return {
        isValid: !lintResults.some((result) => result.severity === "error"),
        errors: lintResults
          .filter((r) => r.severity === "error")
          .map((e) => `Line ${e.line}: ${e.message}`),
        warnings: lintResults
          .filter((r) => r.severity === "warning")
          .map((w) => `Line ${w.line}: ${w.message}`),
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  }

  async build(): Promise<string> {
    try {
      if (this.options.validateOnBuild) {
        const { isValid, errors, warnings } = await this.validate();

        if (!isValid) {
          throw new Error(`Template validation failed:\n${errors.join("\n")}`);
        }

        if (this.options.throwOnWarnings && warnings.length > 0) {
          throw new Error(`Template has warnings:\n${warnings.join("\n")}`);
        }

        if (warnings.length > 0) {
          console.warn("Template warnings:\n", warnings.join("\n"));
        }
      }

      // Replace variables
      let result = this.template;
      Object.entries(this.context).forEach(([key, value]) => {
        const regex = new RegExp(`<${key}>`, "g");
        result = result.replace(regex, value?.toString() ?? "");
      });

      return result;
    } catch (error) {
      throw new Error(
        `Failed to build prompt: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Static helper method for quick template validation
  static async validateTemplate(template: string): Promise<boolean> {
    const builder = new PromptBuilder(template);
    const { isValid } = await builder.validate();
    return isValid;
  }
}
