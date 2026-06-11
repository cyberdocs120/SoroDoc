import { Anthropic } from '@anthropic-ai/sdk';
import { FunctionSpec, DocFunction, AIPromptConfig } from '../types.js';

export interface ExampleInput {
  language: string;
  code: string;
}

export class ExampleGenerator {
  private client: Anthropic;
  private config: AIPromptConfig;
  private maxRetries = 2;

  constructor(client: Anthropic, config: AIPromptConfig) {
    this.client = client;
    this.config = config;
  }

  async generate(spec: FunctionSpec, docFn: DocFunction): Promise<ExampleInput[]> {
    const languages = this.config.exampleLanguages;
    if (languages.length === 0) return [];

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.attemptGenerate(spec, docFn, languages);
      } catch {
        if (attempt === this.maxRetries - 1) {
          return [];
        }
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    return [];
  }

  private async attemptGenerate(
    spec: FunctionSpec,
    docFn: DocFunction,
    languages: string[],
  ): Promise<ExampleInput[]> {
    const langLabels: Record<string, string> = {
      typescript: 'TypeScript',
      python: 'Python',
      rust: 'Rust',
    };
    const examplesXml = languages.map(lang => {
      const label = langLabels[lang] || lang;
      return `  <example language="${label}">\n    // ...\n  </example>`;
    }).join('\n');

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 2048,
      system: `You are a developer educator. Generate concise, runnable code examples for Soroban smart contract functions.`,
      messages: [{
        role: 'user',
        content: `Generate code examples for this Soroban contract function:

Function: ${spec.name}
Description: ${docFn.description}
Parameters:
${spec.params.map(p => `  - ${p.name}: ${JSON.stringify(p.type)}`).join('\n')}
Returns: ${JSON.stringify(spec.returns)} - ${docFn.returns.description}

Generate examples in these languages: ${languages.join(', ')}

For each language, provide a complete, realistic example showing how to call this function using the Soroban SDK.

Respond with XML:
<examples>
${examplesXml}
</examples>`,
      }],
    });

    const content = response.content[0];
    if (content?.type === 'text') {
      return this.parseResponse(content.text, languages);
    }
    return [];
  }

  private parseResponse(text: string, languages: string[]): ExampleInput[] {
    const examples: ExampleInput[] = [];
    const langLabels: Record<string, string> = {
      typescript: 'TypeScript',
      python: 'Python',
      rust: 'Rust',
    };

    for (const langName of languages) {
      const label = langLabels[langName] || langName;
      const regex = new RegExp(`<example\\s+language="${label}"[^>]*>([\\s\\S]*?)<\\/example>`, 'i');
      const match = text.match(regex);
      if (match?.[1]) {
        examples.push({
          language: langName,
          code: match[1].trim(),
        });
      }
    }

    return examples;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
