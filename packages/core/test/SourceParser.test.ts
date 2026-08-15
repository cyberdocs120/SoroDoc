import { describe, it, expect } from 'vitest';
import { SourceParser } from '../src/parser/SourceParser.js';

describe('SourceParser', () => {
  it('parses function doc comments and @sorodoc tags', () => {
    const content = [
      '/// Transfers tokens to a recipient.',
      '///',
      '/// # Arguments',
      '/// * `to` - The recipient.',
      '///',
      '/// @sorodoc:category Finance',
      '/// @sorodoc:since 1.0.0',
      '/// @sorodoc:example-highlight',
      'pub fn transfer(e: Env, to: Address, amount: i128) {',
      '    // implementation',
      '}',
      '',
    ].join('\n');

    const parser = new SourceParser();
    const docs = parser.parseContent(content);

    expect(docs.functions.has('transfer')).toBe(true);
    const fn = docs.functions.get('transfer')!;
    expect(fn.docs).toContain('Transfers tokens to a recipient.');
    expect(fn.category).toBe('Finance');
    expect(fn.since).toBe('1.0.0');
    expect(fn.isHighlighted).toBe(true);
  });

  it('parses event tags from function doc comments', () => {
    const content = `
/// @sorodoc:event Transfer
/// @sorodoc:event-description Emitted when tokens are transferred between accounts.
pub fn transfer(e: Env, from: Address, to: Address, amount: i128) {
    // implementation
}
`;

    const parser = new SourceParser();
    const docs = parser.parseContent(content);

    expect(docs.events.has('Transfer')).toBe(true);
    expect(docs.events.get('Transfer')!.docs).toBe(
      'Emitted when tokens are transferred between accounts.',
    );
  });

  it('parses error enum variant doc comments', () => {
    const content = `
#[contracterror]
pub enum ContractError {
    /// The sender does not have enough balance to complete the transfer.
    InsufficientBalance,
    /// The caller is not authorized to perform this operation.
    Unauthorized,
}
`;

    const parser = new SourceParser();
    const docs = parser.parseContent(content);

    expect(docs.errors.has('InsufficientBalance')).toBe(true);
    expect(docs.errors.get('InsufficientBalance')!.docs).toBe(
      'The sender does not have enough balance to complete the transfer.',
    );
    expect(docs.errors.has('Unauthorized')).toBe(true);
    expect(docs.errors.get('Unauthorized')!.docs).toBe(
      'The caller is not authorized to perform this operation.',
    );
  });

  it('tracks doc blocks only when they immediately precede a declaration', () => {
    const content = `
/// Some orphaned docs.
pub const MAX: u32 = 100;

/// A documented function.
pub fn balance(e: Env, id: Address) -> i128 { 0 }
`;

    const parser = new SourceParser();
    const docs = parser.parseContent(content);

    expect(docs.functions.has('balance')).toBe(true);
    expect(docs.functions.get('balance')!.docs).toBe('A documented function.');
    expect(docs.functions.size).toBe(1);
  });
});
