import type { Block, ParsedTemplate, Role } from "./types.js";

export class Parser {
  static parse(template: string): ParsedTemplate {
    if (typeof template !== "string") {
      throw new Error("Template must be a string");
    }

    const blocks: Block[] = [];
    const variables = new Set<string>();

    // Match all <variable> tags including closing tags like </system>
    const variableRegex = /<([^>]+)>/g;
    const systemTags = new Set([
      "system",
      "user",
      "assistant",
      "/system",
      "/user",
      "/assistant",
    ]);

    // Parse blocks first
    const blockRegex =
      /<(system|user|assistant)(?:\s+name="([^"]*)")?>([^]*?)<\/\1>/g;
    let match;

    while ((match = blockRegex.exec(template)) !== null) {
      const [fullMatch, role, name, content] = match;

      // Find variables in this block's content
      let varMatch;
      while ((varMatch = variableRegex.exec(content)) !== null) {
        const varName = varMatch[1];
        // Only add if it's not a system tag
        if (!systemTags.has(varName)) {
          variables.add(varName);
        }
      }

      blocks.push({
        type: role as Role,
        content: content.trim(),
        name,
        range: {
          start: match.index,
          end: match.index + fullMatch.length,
        },
      });
    }

    return {
      blocks,
      variables: Array.from(variables),
      raw: template,
    };
  }
}
