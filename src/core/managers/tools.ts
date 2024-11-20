import type { Tool, ToolResult } from "@/types/tools";
import path from "path";

export class ToolManager {
  private tools: Map<string, Tool> = new Map();
  private toolsDir: string;

  constructor({ toolsDir }: { toolsDir?: string }) {
    this.toolsDir = toolsDir || path.join(process.cwd(), "ai/tools");
  }

  async loadTool(toolName: string): Promise<void> {
    if (this.tools.has(toolName)) {
      return;
    }

    const toolPath = path.join(this.toolsDir, toolName, "index.ts");

    try {
      const toolModule = await import(toolPath);
      const tool: Tool = toolModule.default;

      if (!tool || !tool.name || !tool.execute) {
        throw new Error(`Invalid tool module structure for ${toolName}`);
      }

      this.tools.set(toolName, tool);
    } catch (error) {
      console.error(`Error loading tool ${toolName}:`, {
        error:
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
                stack: error.stack,
              }
            : error,
        toolPath,
      });
      throw new Error(`Failed to load tool: ${toolName}`);
    }
  }

  async executeTool(toolName: string, params?: any): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      console.error(`Tool not found: ${toolName}`);
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      const result = await tool.execute(params);
      return result;
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, {
        error:
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
                stack: error.stack,
              }
            : error,
      });
      return {
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error executing tool",
      };
    }
  }

  async executeTools(
    tools: string[],
    context?: Record<string, any>
  ): Promise<Record<string, ToolResult>> {
    const results: Record<string, ToolResult> = {};

    for (const toolName of tools) {
      try {
        if (!this.tools.has(toolName)) {
          await this.loadTool(toolName);
        }
        results[toolName] = await this.executeTool(toolName, context);
      } catch (error) {
        console.error(`Failed to execute tool ${toolName}:`, error);
        results[toolName] = {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    return results;
  }

  formatToolResults(results: Record<string, ToolResult>): string {
    let formatted = "\nTool Data:\n";

    for (const [toolName, result] of Object.entries(results)) {
      formatted += `\n${toolName}:\n`;
      if (result.success) {
        formatted += JSON.stringify(result.data, null, 2);
      } else {
        formatted += `Error: ${result.error}`;
      }
      formatted += "\n";
    }

    return formatted;
  }
}
