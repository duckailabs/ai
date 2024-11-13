import { Block, ParsedTemplate, Role } from "./types.js";

export class Parser {
  static parse(template: string): ParsedTemplate {
    if (typeof template !== "string") {
      throw new Error("Template must be a string");
    }

    const blocks: Block[] = [];
    const variables = new Set<string>();
    const variableLocations = new Map<string, number[]>();
    const blockCount: Record<Role, number> = {
      system: 0,
      user: 0,
      assistant: 0,
    };

    // Enhanced regex for more precise matching
    const blockRegex =
      /<(system|user|assistant)(?:\s+name="([^"]*)")?>([^]*?)<\/\1>/g;
    const variableRegex =
      /<([^\/>\s]+)(?:\s+[^>]*)?>(?![^<]*<\/(?:system|user|assistant)>)/g;

    // Track current position for better error reporting
    let currentPos = 0;
    let match;

    // Parse blocks with error handling
    while ((match = blockRegex.exec(template)) !== null) {
      const [fullMatch, role, name, content] = match;

      // Validate content
      if (!content.trim()) {
        throw new Error(
          `Empty content in ${role} block at position ${match.index}`
        );
      }

      // Check for malformed tags
      if (template.slice(currentPos, match.index).includes("<")) {
        const badTagPos = template
          .slice(currentPos, match.index)
          .lastIndexOf("<");
        throw new Error(`Malformed tag at position ${currentPos + badTagPos}`);
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

      blockCount[role as Role]++;
      currentPos = match.index + fullMatch.length;
    }

    // Check for unclosed tags
    if (template.slice(currentPos).includes("<")) {
      throw new Error("Unclosed tag detected at end of template");
    }

    // Parse variables with location tracking
    let varMatch;
    while ((varMatch = variableRegex.exec(template)) !== null) {
      const varName = varMatch[1];
      if (!["system", "user", "assistant"].includes(varName)) {
        variables.add(varName);

        const locations = variableLocations.get(varName) || [];
        locations.push(varMatch.index);
        variableLocations.set(varName, locations);
      }
    }

    return {
      blocks,
      variables: Array.from(variables),
      raw: template,
    };
  }
}
