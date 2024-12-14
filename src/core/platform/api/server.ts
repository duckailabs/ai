import type { Platform } from "@/types";
import type { Server } from "bun";
import crypto from "crypto";
import type { AICore } from "../../ai";
import { ImageManager } from "../../managers/image";
export interface ServerConfig {
  enabled: boolean;
  port: number;
  hostname?: string;
  cors?: {
    allowedOrigins: string[];
  };
  apiKey?: string;
}

export class APIServer {
  private server: Server | null = null;
  private config: ServerConfig;
  private ai: AICore;
  private imageManager: ImageManager;

  constructor(ai: AICore, config: ServerConfig) {
    this.ai = ai;
    this.imageManager = new ImageManager(ai.llmManager, ai.eventService);
    this.config = config;
  }

  async start() {
    if (this.server) {
      console.log("Server is already running");
      return;
    }

    this.server = Bun.serve({
      port: this.config.port,
      hostname: this.config.hostname || "localhost",
      fetch: (request: Request) => this.handleRequest(request),
    });

    console.log(`API Server started on port ${this.config.port}`);
  }

  async stop() {
    if (this.server) {
      this.server.stop();
      this.server = null;
      console.log("API Server stopped");
    }
  }

  private async handleRequest(request: Request): Promise<Response> {
    try {
      if (request.method === "OPTIONS") {
        return this.handleCORS(request);
      }

      if (this.config.apiKey) {
        const authHeader = request.headers.get("Authorization");
        if (!this.validateApiKey(authHeader)) {
          return new Response("Unauthorized", { status: 401 });
        }
      }

      const url = new URL(request.url);

      if (url.pathname === "/api/image" && request.method === "POST") {
        return this.handleImageGeneration(request);
      }
      if (url.pathname === "/api/img" && request.method === "GET") {
        return this.handleImageGeneration();
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("API Error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  private async handleImageGeneration(request?: Request): Promise<Response> {
    try {
      let text = "";
      if (!request) {
        text = "";
      } else {
        const body = await request.json();
        text = body.text;
      }

      const result = await this.imageManager.generateImage(text, {
        messageId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        platform: "api" as Platform,
        user: {
          id: "anonymous",
          username: "anonymous",
        },
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Image generation error:", error);

      // Return appropriate error response
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const status = errorMessage.includes("rate limit")
        ? 429
        : errorMessage.includes("moderation")
        ? 400
        : 500;

      return new Response(JSON.stringify({ error: errorMessage }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private handleCORS(request: Request): Response {
    const origin = request.headers.get("Origin");
    const allowedOrigins = this.config.cors?.allowedOrigins || ["*"];

    const headers = new Headers({
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });

    if (
      origin &&
      (allowedOrigins.includes("*") || allowedOrigins.includes(origin))
    ) {
      headers.set("Access-Control-Allow-Origin", origin);
    }

    return new Response(null, { headers });
  }

  private validateApiKey(authHeader: string | null): boolean {
    if (!this.config.apiKey) return true;
    if (!authHeader) return false;

    const [type, key] = authHeader.split(" ");
    return type === "Bearer" && key === this.config.apiKey;
  }
}
