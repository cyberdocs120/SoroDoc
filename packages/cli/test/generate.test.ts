import { describe, it, expect } from 'vitest';
import { generateCommand } from '../src/commands/generate.js';

describe('generate command', () => {
  it('has correct command name and description', () => {
    expect(generateCommand.name()).toBe('generate');
    expect(generateCommand.description()).toContain('Generate documentation');
  });

  it('accepts --wasm option', () => {
    const wasmOption = generateCommand.options.find(o => o.attributeName() === 'wasm');
    expect(wasmOption).toBeDefined();
  });

  it('accepts --source option', () => {
    const sourceOption = generateCommand.options.find(o => o.attributeName() === 'source');
    expect(sourceOption).toBeDefined();
  });

  it('accepts -n / --name option', () => {
    const nameOption = generateCommand.options.find(o => o.attributeName() === 'name');
    expect(nameOption).toBeDefined();
    expect(nameOption!.short).toBe('-n');
  });

  it('accepts -c / --contract option', () => {
    const contractOption = generateCommand.options.find(o => o.attributeName() === 'contract');
    expect(contractOption).toBeDefined();
    expect(contractOption!.short).toBe('-c');
  });

  it('accepts --network option with default testnet', () => {
    const networkOption = generateCommand.options.find(o => o.attributeName() === 'network');
    expect(networkOption).toBeDefined();
  });

  it('accepts -o / --out option', () => {
    const outOption = generateCommand.options.find(o => o.attributeName() === 'out');
    expect(outOption).toBeDefined();
    expect(outOption!.short).toBe('-o');
  });

  it('accepts --config option', () => {
    const configOption = generateCommand.options.find(o => o.attributeName() === 'config');
    expect(configOption).toBeDefined();
  });

  it('accepts --watch option', () => {
    const watchOption = generateCommand.options.find(o => o.attributeName() === 'watch');
    expect(watchOption).toBeDefined();
  });

  it('requires either --wasm or --contract', () => {
    expect(generateCommand.options.some(o => o.attributeName() === 'wasm')).toBe(true);
    expect(generateCommand.options.some(o => o.attributeName() === 'contract')).toBe(true);
  });
});
