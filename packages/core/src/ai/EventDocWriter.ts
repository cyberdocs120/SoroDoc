import { Anthropic } from '@anthropic-ai/sdk';
import { EventSpec, DocEvent, AIPromptConfig } from '../types.js';

export class EventDocWriter {
  private client: Anthropic;
  private config: AIPromptConfig;
  private maxRetries = 3;

  constructor(client: Anthropic, config: AIPromptConfig) {
    this.client = client;
    this.config = config;
  }

  async write(events: EventSpec[]): Promise<DocEvent[]> {
    if (events.length === 0) return [];

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.attemptWrite(events);
      } catch {
        if (attempt === this.maxRetries - 1) {
          return events.map(e => this.buildFallback(e));
        }
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    return events.map(e => this.buildFallback(e));
  }

  private async attemptWrite(events: EventSpec[]): Promise<DocEvent[]> {
    const toneGuide = this.getToneGuide();
    const customInstr = this.config.customInstructions
      ? `\nAdditional instructions: ${this.config.customInstructions}`
      : '';

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 2048,
      system: `You are a technical documentation expert for Soroban smart contracts. ${toneGuide}${customInstr}
Generate documentation for contract events. Respond only with valid JSON.`,
      messages: [{
        role: 'user',
        content: `Generate documentation for these Soroban contract events:

${events.map(e => `  - Event: ${e.name}
${e.description ? `    Existing description: ${e.description}\n` : ''}    Topics: ${e.topics.map(t => `${t.name} (${this.typeToString(t.type)})`).join(', ') || 'none'}
    Data: ${e.data.map(d => `${d.name} (${this.typeToString(d.type)})`).join(', ') || 'none'}`).join('\n\n')}

Respond with a JSON array:
[
  {
    "name": "EventName",
    "description": "When this event is emitted and what it represents",
    "topics": [{ "name": "topic_name", "description": "What this topic means" }],
    "data": [{ "name": "data_name", "description": "What this data field means" }],
    "example": "TypeScript code showing how to listen for this event using stellar-sdk"
  }
]`,
      }],
    });

    const content = response.content[0];
    if (content?.type === 'text') {
      return this.parseResponse(content.text, events);
    }
    return events.map(e => this.buildFallback(e));
  }

  private parseResponse(text: string, events: EventSpec[]): DocEvent[] {
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) {
      return events.map(e => this.buildFallback(e));
    }

    try {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      return events.map(e => {
        const match = parsed.find((p: { name: string }) => p.name === e.name);
        if (match) {
          return {
            name: e.name,
            description: match.description || e.description || `${e.name} event`,
            topics: e.topics.map(t => ({
              ...t,
              docs: match.topics?.find((tp: { name: string }) => tp.name === t.name)?.description || t.docs,
            })),
            data: e.data.map(d => ({
              ...d,
              docs: match.data?.find((dp: { name: string }) => dp.name === d.name)?.description || d.docs,
            })),
            example: match.example,
          };
        }
        return this.buildFallback(e);
      });
    } catch {
      return events.map(e => this.buildFallback(e));
    }
  }

  private buildFallback(spec: EventSpec): DocEvent {
    return {
      name: spec.name,
      description: spec.description || `${spec.name} event`,
      topics: spec.topics,
      data: spec.data,
    };
  }

  private getToneGuide(): string {
    switch (this.config.tone) {
      case 'technical':
        return 'Be precise and technical. Describe topics and data fields with exact types.';
      case 'friendly':
        return 'Explain events in plain language. Be approachable.';
      case 'enterprise':
        return 'Be formal and thorough. Describe the business significance of each event.';
      case 'educational':
        return 'Explain why the event is published and how it should be consumed.';
      default:
        return 'Be precise and technical. Describe topics and data fields with exact types.';
    }
  }

  private typeToString(type: { kind: string }): string {
    return type.kind;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
