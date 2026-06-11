import { Anthropic } from '@anthropic-ai/sdk';
import { ErrorSpec, DocError, AIPromptConfig } from '../types.js';

export class ErrorDocWriter {
  private client: Anthropic;
  private config: AIPromptConfig;
  private maxRetries = 3;

  constructor(client: Anthropic, config: AIPromptConfig) {
    this.client = client;
    this.config = config;
  }

  async write(errors: ErrorSpec[]): Promise<DocError[]> {
    if (errors.length === 0) return [];

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.attemptWrite(errors);
      } catch {
        if (attempt === this.maxRetries - 1) {
          return errors.map(e => this.buildFallback(e));
        }
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    return errors.map(e => this.buildFallback(e));
  }

  private async attemptWrite(errors: ErrorSpec[]): Promise<DocError[]> {
    const toneGuide = this.getToneGuide();
    const customInstr = this.config.customInstructions
      ? `\nAdditional instructions: ${this.config.customInstructions}`
      : '';

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 2048,
      system: `You are a technical documentation expert for Soroban smart contracts. ${toneGuide}${customInstr}
Generate documentation for error codes in a Soroban contract. Respond only with valid JSON.`,
      messages: [{
        role: 'user',
        content: `Generate error documentation for these contract errors:

${errors.map(e => `  - Code ${e.code}: ${e.name}${e.message ? ` - ${e.message}` : ''}`).join('\n')}

Respond with a JSON array:
[
  {
    "code": 1,
    "name": "ErrorName",
    "description": "When this error occurs and what it means",
    "commonCauses": ["cause1", "cause2"],
    "remediation": "How to fix or avoid this error"
  }
]`,
      }],
    });

    const content = response.content[0];
    if (content?.type === 'text') {
      return this.parseResponse(content.text, errors);
    }
    return errors.map(e => this.buildFallback(e));
  }

  private parseResponse(text: string, errors: ErrorSpec[]): DocError[] {
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) {
      return errors.map(e => this.buildFallback(e));
    }

    try {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      return errors.map(e => {
        const match = parsed.find((p: { code: number; name: string }) => p.code === e.code || p.name === e.name);
        if (match) {
          return {
            code: e.code,
            name: e.name,
            description: match.description || e.description || e.message || '',
            commonCauses: match.commonCauses || [],
            remediation: match.remediation || '',
          };
        }
        return this.buildFallback(e);
      });
    } catch {
      return errors.map(e => this.buildFallback(e));
    }
  }

  private buildFallback(spec: ErrorSpec): DocError {
    return {
      code: spec.code,
      name: spec.name,
      description: spec.description || spec.message || `${spec.name} error`,
      commonCauses: spec.commonCauses || [],
      remediation: spec.remediation || '',
    };
  }

  private getToneGuide(): string {
    switch (this.config.tone) {
      case 'technical':
        return 'Be precise and technical. Include specific conditions that trigger each error.';
      case 'friendly':
        return 'Explain errors in plain language. Be helpful and reassuring.';
      case 'enterprise':
        return 'Be formal and thorough. Include severity levels and impact.';
      case 'educational':
        return 'Explain why the error occurs and the reasoning behind it.';
      default:
        return 'Be precise and technical. Include specific conditions that trigger each error.';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
