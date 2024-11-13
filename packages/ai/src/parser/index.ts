import { BlockType, type Block, type ParsedTemplate } from "../types.js";

export class Parser {
  // Simplified patterns to be more XML-like
  private static readonly BLOCK_PATTERN = /<(\w+)>([\s\S]*?)<\/\1>/gm;
  private static readonly VARIABLE_PATTERN = /<(\w+)>/g;
  private static readonly GEN_PATTERN =
    /<gen\s+'([^']*)'(\s*\|\s*(\{[^}]*\}))?>/g;

  static parse(template: string): ParsedTemplate {
    // Early validation
    if (!template || typeof template !== "string") {
      throw new Error("Invalid template input");
    }

    // Size validation
    if (template.length > 1000000) {
      // 1MB limit
      throw new Error("Template too large");
    }

    const blocks: Block[] = [];
    const variables = new Set<string>();

    // Extract variables first - more efficient than doing it per block
    Array.from(template.matchAll(this.VARIABLE_PATTERN)).forEach((match) => {
      // Remove special character checks since we're using pure XML format
      if (!match[1].includes("/")) {
        // Only exclude closing tags
        variables.add(match[1]);
      }
    });

    // Parse top-level blocks
    let match;
    let lastIndex = 0;

    while ((match = this.BLOCK_PATTERN.exec(template)) !== null) {
      const [fullMatch, type, content] = match;

      // Skip if this is a nested block we'll handle later
      if (lastIndex > match.index) {
        continue;
      }

      const blockType = this.validateBlockType(type);
      if (!blockType) continue;

      const block: Block = {
        type: blockType,
        content: content.trim(),
        range: {
          start: match.index,
          end: match.index + fullMatch.length,
        },
      };

      // Check for nested blocks with simplified pattern
      if (content.includes("<")) {
        block.children = this.parseNestedBlocks(content);
      }

      blocks.push(block);
      lastIndex = this.BLOCK_PATTERN.lastIndex;
    }

    return { blocks, raw: template, variables };
  }

  private static parseNestedBlocks(content: string): Block[] {
    const blocks: Block[] = [];
    const matches = Array.from(content.matchAll(this.BLOCK_PATTERN));

    for (const match of matches) {
      const [fullMatch, type, nestedContent] = match;
      const blockType = this.validateBlockType(type);
      if (blockType) {
        blocks.push({
          type: blockType,
          content: nestedContent.trim(),
          range: {
            start: match.index,
            end: match.index + fullMatch.length,
          },
        });
      }
    }

    return blocks;
  }

  private static validateBlockType(type: string): BlockType | null {
    const result = BlockType.safeParse(type);
    return result.success ? result.data : null;
  }
}
