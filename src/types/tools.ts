export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
}

export interface Tool {
  name: string;
  execute: (params?: any) => Promise<ToolResult>;
}
