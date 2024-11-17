export class Formatter {
  static format(template: string): string {
    // Remove extra whitespace
    let formatted = template.replace(/\s+/g, " ");

    // Add proper newlines between blocks
    formatted = formatted.replace(/}}\s*{{/g, "}}\n\n{{");

    // Indent nested blocks
    formatted = this.indentBlocks(formatted);

    return formatted.trim();
  }

  private static indentBlocks(template: string): string {
    const lines = template.split("\n");
    const indented: string[] = [];
    let indentLevel = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();

      // Decrease indent for closing tags
      if (trimmed.startsWith("{{/")) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add line with proper indentation
      indented.push("  ".repeat(indentLevel) + trimmed);

      // Increase indent for opening tags
      if (trimmed.startsWith("{{#")) {
        indentLevel++;
      }
    });

    return indented.join("\n");
  }
}
