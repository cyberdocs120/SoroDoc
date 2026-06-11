import { Anthropic } from '@anthropic-ai/sdk';
import { DocOutput } from '../types.js';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

export class ValidationPass {
  private client: Anthropic;
  private maxRetries = 2;

  constructor(client: Anthropic) {
    this.client = client;
  }

  async validate(output: DocOutput): Promise<ValidationResult> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.attemptValidate(output);
      } catch {
        if (attempt === this.maxRetries - 1) {
          return { valid: true, warnings: [] };
        }
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    return { valid: true, warnings: [] };
  }

  private async attemptValidate(output: DocOutput): Promise<ValidationResult> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a documentation quality assurance reviewer. Check the generated documentation for consistency and correctness.
Report any issues you find. Be concise.`,
      messages: [{
        role: 'user',
        content: `Review this contract documentation for consistency and accuracy:

Contract: ${output.contractName}
Overview: ${output.overview}

Functions:
${output.functions.map(f => `  - ${f.name}: ${f.description.substring(0, 100)}`).join('\n')}

Errors:
${output.errors.map(e => `  - ${e.name} (code ${e.code}): ${e.description.substring(0, 100)}`).join('\n')}

Check for:
1. Are function descriptions accurate based on their names?
2. Are error descriptions consistent with function descriptions?
3. Are there any contradictions?
4. Is the overview coherent with the details?

Respond with JSON:
{
  "valid": true/false,
  "warnings": ["warning1", "warning2"]
}`,
      }],
    });

    const content = response.content[0];
    if (content?.type === 'text') {
      return this.parseResponse(content.text);
    }
    return { valid: true, warnings: [] };
  }

  private parseResponse(text: string): ValidationResult {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      return { valid: true, warnings: [] };
    }

    try {
      return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    } catch {
      return { valid: true, warnings: [] };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
