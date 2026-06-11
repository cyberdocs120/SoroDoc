import { Anthropic } from '@anthropic-ai/sdk';
import {
  ContractABI,
  DocOutput,
  AIPromptConfig,
} from '../types.js';
import { FunctionDocWriter } from './FunctionDocWriter.js';
import { ErrorDocWriter } from './ErrorDocWriter.js';
import { ExampleGenerator } from './ExampleGenerator.js';
import { ValidationPass } from './ValidationPass.js';

export interface DocEngineOptions {
  apiKey?: string;
  client?: Anthropic;
  onProgress?: (phase: string, current: number, total: number) => void;
}

function buildFallback(abi: ContractABI): DocOutput {
  return {
    contractName: abi.name,
    overview: `${abi.name} is a Soroban smart contract with ${abi.functions.length} function${abi.functions.length !== 1 ? 's' : ''}, ${abi.events.length} event${abi.events.length !== 1 ? 's' : ''}, and ${abi.errors.length} error type${abi.errors.length !== 1 ? 's' : ''}.`,
    functions: abi.functions.map(f => ({
      name: f.name,
      description: f.docs || `${f.name} function`,
      params: f.params.map(p => ({
        name: p.name,
        type: p.type,
        description: p.docs || '',
      })),
      returns: {
        type: f.returns,
        description: '',
      },
    })),
    events: abi.events.map(e => ({
      name: e.name,
      description: e.description || `${e.name} event`,
      topics: e.topics,
      data: e.data,
    })),
    errors: abi.errors.map(e => ({
      code: e.code,
      name: e.name,
      description: e.description || e.message || `${e.name} error`,
      commonCauses: e.commonCauses || [],
      remediation: e.remediation || '',
    })),
  };
}

function getToneGuide(tone: string): string {
  switch (tone) {
    case 'technical':
      return 'Use precise technical language. Describe parameters, return values, and edge cases in detail. Be exhaustive.';
    case 'friendly':
      return 'Use approachable, conversational language. Explain concepts simply. Be encouraging and clear.';
    case 'enterprise':
      return 'Use formal, professional language suitable for enterprise documentation. Emphasize reliability and security.';
    case 'educational':
      return 'Use teaching-oriented language. Explain not just what something does but why and how it works. Include conceptual background.';
    default:
      return 'Use precise technical language. Describe parameters, return values, and edge cases in detail. Be exhaustive.';
  }
}

export class DocEngine {
  private client: Anthropic | null = null;
  private options: DocEngineOptions;

  constructor(options: DocEngineOptions = {}) {
    this.options = options;
    if (options.client) {
      this.client = options.client;
    } else {
      const apiKey = options.apiKey || process.env['ANTHROPIC_API_KEY'];
      if (apiKey) {
        this.client = new Anthropic({ apiKey });
      }
    }
  }

  async generate(abi: ContractABI, config: AIPromptConfig): Promise<DocOutput> {
    if (!config.enabled || !this.client) {
      return buildFallback(abi);
    }

    const functionWriter = new FunctionDocWriter(this.client, config);
    const errorWriter = new ErrorDocWriter(this.client, config);
    const exampleGenerator = new ExampleGenerator(this.client, config);
    const validator = new ValidationPass(this.client);

    const totalSteps = 1 + abi.functions.length + 1;

    this.options.onProgress?.('overview', 0, totalSteps);
    const overview = await this.generateOverview(abi, config);

    const functions: DocOutput['functions'] = [];
    for (let i = 0; i < abi.functions.length; i++) {
      this.options.onProgress?.('functions', i + 1, totalSteps);
      const fn = abi.functions[i]!;
      const docFn = await functionWriter.write(fn, abi.errors);
      functions.push(docFn);
    }

    this.options.onProgress?.('errors', 1 + abi.functions.length, totalSteps);
    const errors = await errorWriter.write(abi.errors);

    if (config.generateExamples) {
      for (let i = 0; i < functions.length; i++) {
        const fn = abi.functions[i]!;
        const docFn = functions[i]!;
        if (docFn) {
          docFn.examples = await exampleGenerator.generate(fn, docFn);
        }
      }
    }

    const result: DocOutput = {
      contractName: abi.name,
      overview,
      functions,
      events: abi.events.map(e => ({
        name: e.name,
        description: e.description || '',
        topics: e.topics,
        data: e.data,
      })),
      errors,
    };

    if (config.generateExamples) {
      const validation = await validator.validate(result);
      if (!validation.valid) {
        console.warn('DocEngine validation warnings:', validation.warnings);
      }
    }

    return result;
  }

  private async generateOverview(abi: ContractABI, config: AIPromptConfig): Promise<string> {
    try {
      const toneGuide = getToneGuide(config.tone);
      const customInstr = config.customInstructions
        ? `\nAdditional instructions: ${config.customInstructions}`
        : '';

      const response = await this.client!.messages.create({
        model: config.model,
        max_tokens: 1024,
        system: `You are a technical documentation expert for Soroban smart contracts. ${toneGuide}${customInstr}
Generate a concise overview paragraph for the contract based on its functions, events, and errors.`,
        messages: [{
          role: 'user',
          content: `Generate a 2-3 sentence overview for this Soroban smart contract:

Contract Name: ${abi.name}

Functions:
${abi.functions.map(f => `- ${f.name}(${f.params.map(p => `${p.name}: ${p.type.kind}`).join(', ')}): ${f.returns.kind}`).join('\n')}

Events:
${abi.events.map(e => `- ${e.name}`).join('\n')}

Errors:
${abi.errors.map(e => `- ${e.name} (code ${e.code}): ${e.message || ''}`).join('\n')}`,
        }],
      });

      const content = response.content[0];
      if (content?.type === 'text') {
        return content.text;
      }
      return `${abi.name} is a Soroban smart contract with ${abi.functions.length} functions, ${abi.events.length} events, and ${abi.errors.length} error types.`;
    } catch {
      return `${abi.name} is a Soroban smart contract with ${abi.functions.length} functions, ${abi.events.length} events, and ${abi.errors.length} error types.`;
    }
  }
}
