import type { Tool } from "@/types/tools";
import fs from "fs/promises";
import path from "path";

export class ToolManager {
  private tools: Map<string, Tool> = new Map();
  private toolsDir: string;

  constructor({ toolsDir }: { toolsDir?: string }) {
    this.toolsDir = toolsDir || path.join(process.cwd(), "ai/tools");
  }

  private async scanToolsDirectory(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.toolsDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch (error) {
      console.error("Error scanning tools directory:", error);
      return [];
    }
  }

  async loadAllTools(): Promise<void> {
    const toolDirectories = await this.scanToolsDirectory();

    for (const dir of toolDirectories) {
      try {
        await this.loadTool(dir);
      } catch (error) {
        console.error(`Failed to load tool from directory ${dir}:`, error);
      }
    }
  }

  private async loadTool(toolName: string): Promise<void> {
    if (this.tools.has(toolName)) {
      return;
    }

    const toolPath = path.join(this.toolsDir, toolName, "index.ts");

    try {
      const toolModule = await import(toolPath);
      const tool = toolModule.default as Tool;

      if (!this.validateToolStructure(tool)) {
        throw new Error(`Invalid tool module structure for ${toolName}`);
      }

      this.tools.set(toolName, tool);
    } catch (error) {
      console.error(`Error loading tool ${toolName}:`, {
        error:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
        toolName,
        toolPath,
      });
      throw new Error(`Failed to load tool: ${toolName}`);
    }
  }

  private validateToolStructure(tool: unknown): tool is Tool {
    if (!tool || typeof tool !== "object") return false;

    const t = tool as Tool;
    return (
      typeof t.name === "string" &&
      typeof t.execute === "function" &&
      t.config !== undefined &&
      typeof t.config.name === "string" &&
      typeof t.config.version === "string"
    );
  }

  async executeTools(
    toolNames: string[],
    toolParams?: Record<string, unknown>
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const toolName of toolNames) {
      try {
        if (!this.tools.has(toolName)) {
          await this.loadTool(toolName);
        }

        const tool = this.tools.get(toolName)!;
        const startTime = Date.now();

        // Only validate params if schema exists and validation is desired
        let params = toolParams;
        if (tool.config.schema?.params && toolParams) {
          try {
            params = tool.config.schema.params.parse(toolParams);
          } catch (error) {
            // If validation fails, continue with original params
            console.warn(
              `Param validation failed for ${toolName}, using original params:`,
              error
            );
          }
        }

        const result = await tool.execute(params);
        const executionTime = Date.now() - startTime;

        if (result.success && result.data) {
          // Only validate result if schema exists and validation is desired
          let data = result.data;
          if (tool.config.schema?.result) {
            try {
              data = tool.config.schema.result.parse(result.data);
            } catch (error) {
              console.warn(`Result validation failed for ${toolName}:`, error);
              // Continue with original data
            }
          }

          results[toolName] = {
            success: true,
            data,
            metadata: {
              ...result.metadata,
              executionTime,
              timestamp: new Date().toISOString(),
            },
          };
        } else {
          results[toolName] = result;
        }
      } catch (error) {
        console.error(`Failed to execute tool ${toolName}:`, error);
        results[toolName] = {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
          metadata: {
            timestamp: new Date().toISOString(),
          },
        };
      }
    }

    return results;
  }

  getLoadedTools(): string[] {
    return Array.from(this.tools.keys());
  }

  formatToolResults(results: Record<string, any>): string {
    return Object.entries(results)
      .map(([toolName, result]) => {
        const data = result.success
          ? JSON.stringify(result.data, null, 2)
          : `Error: ${result.error}`;
        return `\n${toolName}:\n${data}\n`;
      })
      .join("");
  }
}
