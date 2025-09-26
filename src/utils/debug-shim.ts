import { createRequire } from "module";

let patched = false;

export function ensureDebugModulePatched(): void {
  if (patched) return;

  try {
    const require = createRequire(import.meta.url);
    const debugModule = require("debug") as any;
    const candidate =
      typeof debugModule === "function"
        ? debugModule
        : typeof debugModule?.default === "function"
          ? debugModule.default
          : null;

    if (candidate) {
      if (typeof debugModule.debug !== "function") {
        debugModule.debug = candidate;
      }
      if (typeof debugModule.default !== "function") {
        debugModule.default = candidate;
      }
      if (typeof candidate.debug !== "function") {
        candidate.debug = candidate;
      }
    }
  } catch (error) {
    console.warn("Failed to patch debug module", error);
  }

  patched = true;
}
