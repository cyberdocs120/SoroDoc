import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocEngine } from '../src/ai/DocEngine.js';
import { FunctionDocWriter } from '../src/ai/FunctionDocWriter.js';
import { ErrorDocWriter } from '../src/ai/ErrorDocWriter.js';
import { ExampleGenerator } from '../src/ai/ExampleGenerator.js';
import { ValidationPass } from '../src/ai/ValidationPass.js';
import type { ContractABI, AIPromptConfig, DocFunction, DocError, FunctionSpec, ErrorSpec } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContractABI(overrides?: Partial<ContractABI>): ContractABI {
  return {
    name: 'TestContract',
    version: '1.0.0',
    functions: [
      {
        name: 'transfer',
        params: [
          { name: 'to', type: { kind: 'address' } },
          { name: 'amount', type: { kind: 'i128' } },
        ],
        returns: { kind: 'void' },
        docs: 'Transfers tokens.',
      },
    ],
    events: [
      {
        name: 'Transfer',
        description: 'Emitted when tokens are transferred.',
        topics: [
          { index: 0, name: 'from', type: { kind: 'address' } },
        ],
        data: [
          { name: 'amount', type: { kind: 'i128' } },
        ],
      },
    ],
    errors: [
      { code: 1, name: 'InsufficientBalance', message: 'Balance too low' },
    ],
    types: [],
    ...overrides,
  };
}

function makeAIConfig(overrides?: Partial<AIPromptConfig>): AIPromptConfig {
  return {
    enabled: false,
    model: 'claude-sonnet-4-20250514',
    tone: 'technical',
    generateExamples: false,
    exampleLanguages: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DocEngine
// ---------------------------------------------------------------------------

describe('DocEngine', () => {
  describe('fallback (AI disabled or no API key)', () => {
    it('returns fallback output when AI is disabled', async () => {
      const engine = new DocEngine({ apiKey: 'test-key' });
      const abi = makeContractABI();
      const config = makeAIConfig({ enabled: false });

      const result = await engine.generate(abi, config);

      expect(result.contractName).toBe('TestContract');
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0]!.name).toBe('transfer');
      expect(result.functions[0]!.description).toBe('Transfers tokens.');
      expect(result.events).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.code).toBe(1);
    });

    it('returns fallback output when no API key is provided', async () => {
      const engine = new DocEngine();
      const abi = makeContractABI();
      const config = makeAIConfig({ enabled: true });

      const result = await engine.generate(abi, config);

      expect(result.contractName).toBe('TestContract');
      expect(result.overview).toContain('Soroban');
    });

    it('includes commonCauses and remediation from ABI if available in fallback', async () => {
      const abi = makeContractABI({
        errors: [
          {
            code: 1,
            name: 'InsufficientBalance',
            message: 'Balance too low',
            commonCauses: ['Not enough funds', 'Incorrect account'],
            remediation: 'Add more funds',
          },
        ],
      });
      const engine = new DocEngine();
      const config = makeAIConfig({ enabled: false });

      const result = await engine.generate(abi, config);

      expect(result.errors[0]!.commonCauses).toEqual(['Not enough funds', 'Incorrect account']);
      expect(result.errors[0]!.remediation).toBe('Add more funds');
    });

    it('handles contract with no functions, events, or errors', async () => {
      const abi = makeContractABI({ functions: [], events: [], errors: [] });
      const engine = new DocEngine();
      const config = makeAIConfig({ enabled: true });

      const result = await engine.generate(abi, config);

      expect(result.functions).toHaveLength(0);
      expect(result.events).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('calls onProgress callback during fallback generation', async () => {
      const onProgress = vi.fn();
      const engine = new DocEngine({ onProgress });
      const abi = makeContractABI({
        functions: [
          { name: 'f1', params: [], returns: { kind: 'void' } },
          { name: 'f2', params: [], returns: { kind: 'void' } },
        ],
      });
      const config = makeAIConfig({ enabled: false });

      await engine.generate(abi, config);

      expect(onProgress).not.toHaveBeenCalled();
    });
  });

  describe('with mocked Anthropic client', () => {
    it('generates doc output when AI succeeds', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'The contract overview text.' }],
      });
      const mockMessages = { create: mockCreate };
      const mockClient = {
        messages: mockMessages,
      } as any;

      const engine = new DocEngine({ client: mockClient });
      const abi = makeContractABI({ functions: [] });
      const config = makeAIConfig({ enabled: true, model: 'claude-sonnet-4-20250514' });

      const result = await engine.generate(abi, config);

      expect(result.contractName).toBe('TestContract');
      expect(mockCreate).toHaveBeenCalled();
    });

    it('calls onProgress during AI generation', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Overview text.' }],
      });
      const mockClient = { messages: { create: mockCreate } } as any;
      const onProgress = vi.fn();

      const engine = new DocEngine({ client: mockClient, onProgress });
      const abi = makeContractABI({ functions: [{ name: 'f1', params: [], returns: { kind: 'void' } }] });
      const config = makeAIConfig({ enabled: true, tone: 'technical' });

      await engine.generate(abi, config);

      expect(onProgress).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// FunctionDocWriter
// ---------------------------------------------------------------------------

describe('FunctionDocWriter', () => {
  it('returns fallback doc when all retries fail', async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error('API error'));
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    vi.spyOn(client.messages, 'create').mockImplementation(mockCreate);

    const config = makeAIConfig({ enabled: true, tone: 'technical' });
    const writer = new FunctionDocWriter(client, config);

    const spec: FunctionSpec = {
      name: 'transfer',
      params: [{ name: 'to', type: { kind: 'address' } }],
      returns: { kind: 'void' },
    };
    const result = await writer.write(spec, []);

    expect(result.name).toBe('transfer');
    expect(result.description).toBe('transfer function');
    expect(result.params).toHaveLength(1);
  });

  it('parses valid JSON from AI response', async () => {
    const aiResponse = JSON.stringify({
      description: 'Transfers tokens to a recipient.',
      params: [{ description: 'The recipient address.' }],
      returns: { description: 'Nothing.' },
    });
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: aiResponse }],
    });
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    vi.spyOn(client.messages, 'create').mockImplementation(mockCreate);

    const config = makeAIConfig({ enabled: true });
    const writer = new FunctionDocWriter(client, config);

    const spec: FunctionSpec = {
      name: 'transfer',
      params: [{ name: 'to', type: { kind: 'address' } }],
      returns: { kind: 'void' },
      docs: 'Original docs.',
    };
    const result = await writer.write(spec, []);

    expect(result.description).toBe('Transfers tokens to a recipient.');
    expect(result.params[0]!.description).toBe('The recipient address.');
    expect(result.returns.description).toBe('Nothing.');
  });

  it('preserves AI-generated error references in doc', async () => {
    const aiResponse = JSON.stringify({
      description: 'Test function.',
      params: [],
      returns: { description: 'Nothing.' },
      errors: [{ code: 1, name: 'TestError', description: 'When test fails.' }],
    });
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: aiResponse }],
    });
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    vi.spyOn(client.messages, 'create').mockImplementation(mockCreate);

    const config = makeAIConfig({ enabled: true });
    const writer = new FunctionDocWriter(client, config);

    const spec: FunctionSpec = {
      name: 'test',
      params: [],
      returns: { kind: 'void' },
    };
    const result = await writer.write(spec, []);

    expect(result.errors).toHaveLength(1);
    expect(result.errors![0]!.name).toBe('TestError');
    expect(result.errors![0]!.code).toBe(1);
  });

  it('falls back to spec docs when AI returns incomplete JSON', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{ invalid json' }],
    });
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    vi.spyOn(client.messages, 'create').mockImplementation(mockCreate);

    const config = makeAIConfig({ enabled: true });
    const writer = new FunctionDocWriter(client, config);

    const spec: FunctionSpec = {
      name: 'transfer',
      params: [{ name: 'to', type: { kind: 'address' }, docs: 'The recipient.' }],
      returns: { kind: 'void' },
      docs: 'Transfers tokens.',
    };
    const result = await writer.write(spec, []);

    expect(result.description).toBe('Transfers tokens.');
    expect(result.params[0]!.description).toBe('The recipient.');
  });
});

// ---------------------------------------------------------------------------
// ErrorDocWriter
// ---------------------------------------------------------------------------

describe('ErrorDocWriter', () => {
  it('returns empty array for no errors', async () => {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    const config = makeAIConfig({ enabled: true });
    const writer = new ErrorDocWriter(client, config);

    const result = await writer.write([]);
    expect(result).toHaveLength(0);
  });

  it('returns fallback when AI call fails', async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error('API error'));
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    vi.spyOn(client.messages, 'create').mockImplementation(mockCreate);

    const config = makeAIConfig({ enabled: true });
    const writer = new ErrorDocWriter(client, config);

    const errors: ErrorSpec[] = [
      { code: 1, name: 'InsufficientBalance', message: 'Balance too low' },
    ];
    const result = await writer.write(errors);

    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe(1);
    expect(result[0]!.name).toBe('InsufficientBalance');
    expect(result[0]!.description).toBe('Balance too low');
  });

  it('parses AI response into DocError array', async () => {
    const aiResponse = JSON.stringify([
      {
        code: 1,
        name: 'InsufficientBalance',
        description: 'Insufficient balance error.',
        commonCauses: ['Low funds'],
        remediation: 'Add more tokens.',
      },
    ]);
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: aiResponse }],
    });
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    vi.spyOn(client.messages, 'create').mockImplementation(mockCreate);

    const config = makeAIConfig({ enabled: true });
    const writer = new ErrorDocWriter(client, config);

    const errors: ErrorSpec[] = [
      { code: 1, name: 'InsufficientBalance', message: 'Balance too low' },
    ];
    const result = await writer.write(errors);

    expect(result[0]!.description).toBe('Insufficient balance error.');
    expect(result[0]!.commonCauses).toEqual(['Low funds']);
    expect(result[0]!.remediation).toBe('Add more tokens.');
  });
});

// ---------------------------------------------------------------------------
// ExampleGenerator
// ---------------------------------------------------------------------------

describe('ExampleGenerator', () => {
  it('returns empty array when no languages configured', async () => {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    const config = makeAIConfig({ enabled: true, generateExamples: true, exampleLanguages: [] });
    const generator = new ExampleGenerator(client, config);

    const spec: FunctionSpec = { name: 'test', params: [], returns: { kind: 'void' } };
    const docFn: DocFunction = { name: 'test', description: 'Test', params: [], returns: { type: { kind: 'void' }, description: '' } };
    const result = await generator.generate(spec, docFn);

    expect(result).toHaveLength(0);
  });

  it('returns empty array when AI call fails', async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error('API error'));
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    vi.spyOn(client.messages, 'create').mockImplementation(mockCreate);

    const config = makeAIConfig({ enabled: true, generateExamples: true, exampleLanguages: ['typescript'] });
    const generator = new ExampleGenerator(client, config);

    const spec: FunctionSpec = { name: 'test', params: [], returns: { kind: 'void' } };
    const docFn: DocFunction = { name: 'test', description: 'Test', params: [], returns: { type: { kind: 'void' }, description: '' } };
    const result = await generator.generate(spec, docFn);

    expect(result).toHaveLength(0);
  });

  it('parses XML example response', async () => {
    const aiResponse = `<examples>
  <example language="TypeScript">
    const contract = new Contract(contractId);
    await contract.test();
  </example>
  <example language="Python">
    contract = Contract(contract_id)
    await contract.test()
  </example>
</examples>`;
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: aiResponse }],
    });
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    vi.spyOn(client.messages, 'create').mockImplementation(mockCreate);

    const config = makeAIConfig({
      enabled: true,
      generateExamples: true,
      exampleLanguages: ['typescript', 'python'],
    });
    const generator = new ExampleGenerator(client, config);

    const spec: FunctionSpec = { name: 'test', params: [], returns: { kind: 'void' } };
    const docFn: DocFunction = { name: 'test', description: 'Test', params: [], returns: { type: { kind: 'void' }, description: '' } };
    const result = await generator.generate(spec, docFn);

    expect(result).toHaveLength(2);
    expect(result[0]!.language).toBe('typescript');
    expect(result[0]!.code).toContain('const contract');
    expect(result[1]!.language).toBe('python');
    expect(result[1]!.code).toContain('contract = Contract');
  });
});

// ---------------------------------------------------------------------------
// ValidationPass
// ---------------------------------------------------------------------------

describe('ValidationPass', () => {
  it('returns valid=true when AI call fails', async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error('API error'));
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    vi.spyOn(client.messages, 'create').mockImplementation(mockCreate);

    const validator = new ValidationPass(client);

    const output = {
      contractName: 'Test',
      overview: 'Overview.',
      functions: [],
      events: [],
      errors: [],
    };
    const result = await validator.validate(output);

    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('parses JSON validation result', async () => {
    const aiResponse = JSON.stringify({
      valid: false,
      warnings: ['Overview is too short.', 'Missing error descriptions.'],
    });
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: aiResponse }],
    });
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: 'test' });
    vi.spyOn(client.messages, 'create').mockImplementation(mockCreate);

    const validator = new ValidationPass(client);
    const output = {
      contractName: 'Test',
      overview: 'Short.',
      functions: [],
      events: [],
      errors: [{ code: 1, name: 'Err', description: '', commonCauses: [], remediation: '' }],
    };
    const result = await validator.validate(output);

    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(2);
  });
});
