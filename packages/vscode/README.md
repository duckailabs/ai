# Prompt Guidance VSCode Extension

A powerful VSCode extension for prompt engineering with AI language models.

## Features

- Syntax highlighting for prompt templates
- Real-time validation and suggestions
- AI-powered improvements
- Auto-completion for blocks and variables
- Preview functionality
- Format on save

## Installation

Search for "Prompt Guidance" in the VSCode marketplace or install directly from:
[VSCode Marketplace Link]

## Usage

1. Create a new file with `.pg` or `.prompt` extension
2. Start writing your template:

```promptguidance
{{#system}}
You are a helpful AI assistant focused on {{domain}}.
{{/system}}

{{#user}}
Help me with {{task}}
{{/user}}
```

## Configuration

Open settings and configure:

- `promptGuidance.openaiApiKey`: Your OpenAI API key
- `promptGuidance.enableLiveAnalysis`: Enable/disable real-time analysis
- `promptGuidance.formatOnSave`: Enable/disable format on save

## Contributing

See our [Contributing Guide](CONTRIBUTING.md)

## License

MIT
