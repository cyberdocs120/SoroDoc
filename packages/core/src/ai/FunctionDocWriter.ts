import { Anthropic } from '@anthropic-ai/sdk';
import { FunctionSpec, DocFunction, AIPromptConfig, ErrorSpec } from '../types.js';

export class FunctionDocWriter {
  private client: Anthropic;
  private config: AIPromptConfig;
  private maxRetries = 3;

  constructor(client: Anthropic, config: AIPromptConfig) {
    this.client = client;
    this.config = config;
  }

  async write(spec: FunctionSpec, errors: ErrorSpec[]): Promise<DocFunction> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.attemptWrite(spec, errors);
      } catch {
        if (attempt === this.maxRetries - 1) {
          return this.buildFallback(spec);
        }
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    return this.buildFallback(spec);
  }

  private async attemptWrite(spec: FunctionSpec, errors: ErrorSpec[]): Promise<DocFunction> {
    const toneGuide = this.getToneGuide();
    const customInstr = this.config.customInstructions
      ? `\nAdditional instructions: ${this.config.customInstructions}`
      : '';

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 2048,
      system: `You are a technical documentation expert for Soroban smart contracts. ${toneGuide}${customInstr}
Generate JSON documentation for the given Soroban contract function. Respond only with valid JSON matching the schema.`,
      messages: [{
        role: 'user',
        content: `Generate documentation for this Soroban function:

Function: ${spec.name}
Parameters:
${spec.params.map(p => `  - ${p.name}: ${this.typeToString(p.type)}${p.docs ? ` (${p.docs})` : ''}`).join('\n')}
Return Type: ${this.typeToString(spec.returns)}
${spec.docs ? `Existing docs: ${spec.docs}` : ''}
${spec.category ? `Category: ${spec.category}` : ''}
${spec.since ? `Since: ${spec.since}` : ''}

Related possible errors:
${errors.map(e => `  - ${e.name} (code ${e.code})${e.message ? `: ${e.message}` : ''}`).join('\n')}

Respond with JSON:
{
  "name": "${spec.name}",
  "description": "A clear description of what this function does",
  "params": [
    { "name": "param_name", "type": {"kind": "type_kind"}, "description": "description of param" }
  ],
  "returns": { "type": {"kind": "type_kind"}, "description": "description of return value" },
  "errors": [
    { "code": 1, "name": "ErrorName", "description": "when this error occurs" }
  ]
}`,
      }],
    });

    const content = response.content[0];
    if (content?.type === 'text') {
      return this.parseResponse(content.text, spec);
    }
    return this.buildFallback(spec);
  }

  private parseResponse(text: string, spec: FunctionSpec): DocFunction {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      return this.buildFallback(spec);
    }

    try {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      return {
        name: spec.name,
        description: parsed.description || spec.docs || '',
        params: spec.params.map((p, i) => ({
          name: p.name,
          type: p.type,
          description: parsed.params?.[i]?.description || p.docs || '',
          examples: parsed.params?.[i]?.examples,
        })),
        returns: {
          type: spec.returns,
          description: parsed.returns?.description || '',
        },
        errors: parsed.errors || [],
      };
    } catch {
      return this.buildFallback(spec);
    }
  }

  private buildFallback(spec: FunctionSpec): DocFunction {
    return {
      name: spec.name,
      description: spec.docs || `${spec.name} function`,
      params: spec.params.map(p => ({
        name: p.name,
        type: p.type,
        description: p.docs || '',
      })),
      returns: {
        type: spec.returns,
        description: '',
      },
    };
  }

  private getToneGuide(): string {
    switch (this.config.tone) {
      case 'technical':
        return 'Use precise technical language. Describe parameters, return values, and edge cases in detail.';
      case 'friendly':
        return 'Use approachable, conversational language. Explain concepts simply.';
      case 'enterprise':
        return 'Use formal, professional language. Emphasize reliability and security.';
      case 'educational':
        return 'Use teaching-oriented language. Explain why and how it works.';
      default:
        return 'Use precise technical language. Describe parameters, return values, and edge cases in detail.';
    }
  }

  private typeToString(type: { kind: string }): string {
    return type.kind;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
