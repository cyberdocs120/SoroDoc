import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MarkdownRenderer } from '../src/renderers/MarkdownRenderer.js';
import { DocusaurusRenderer } from '../src/renderers/DocusaurusRenderer.js';
import { OpenAPIRenderer } from '../src/renderers/OpenAPIRenderer.js';
import type { DocOutput } from '../src/types.js';

function makeDocOutput(overrides?: Partial<DocOutput>): DocOutput {
  return {
    contractName: 'TokenContract',
    overview: 'A Soroban token contract with transfer and balance features.',
    functions: [
      {
        name: 'transfer',
        description: 'Transfers tokens from sender to recipient.',
        params: [
          { name: 'to', type: { kind: 'address' }, description: 'The recipient address.' },
          { name: 'amount', type: { kind: 'i128' }, description: 'The amount to transfer.' },
        ],
        returns: { type: { kind: 'void' }, description: 'Nothing.' },
      },
      {
        name: 'balance',
        description: 'Returns the balance for a given account.',
        params: [
          { name: 'account', type: { kind: 'address' }, description: 'The account address.' },
        ],
        returns: { type: { kind: 'i128' }, description: 'The account balance.' },
      },
    ],
    events: [
      {
        name: 'Transfer',
        description: 'Emitted when tokens are transferred.',
        topics: [
          { index: 0, name: 'from', type: { kind: 'address' } },
          { index: 1, name: 'to', type: { kind: 'address' } },
        ],
        data: [
          { name: 'amount', type: { kind: 'i128' } },
        ],
      },
    ],
    errors: [
      {
        code: 1,
        name: 'InsufficientBalance',
        description: 'The sender does not have enough balance.',
        commonCauses: ['Insufficient funds', 'Account not funded'],
        remediation: 'Ensure the account has sufficient tokens.',
      },
    ],
    ...overrides,
  };
}

describe('MarkdownRenderer', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sorodoc-md-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates markdown files for all documentation sections', () => {
    const renderer = new MarkdownRenderer({ outputDir: tmpDir });
    const output = makeDocOutput();
    const result = renderer.render(output);

    expect(result.docs.contractName).toBe('TokenContract');
    expect(fs.existsSync(path.join(tmpDir, 'markdown/index.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'markdown/functions/transfer.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'markdown/functions/balance.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'markdown/events/Transfer.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'markdown/errors/error-reference.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'markdown/sdk/quickstart.md'))).toBe(true);
  });

  it('includes frontmatter in generated markdown', () => {
    const renderer = new MarkdownRenderer({ outputDir: tmpDir });
    renderer.render(makeDocOutput());

    const indexContent = fs.readFileSync(path.join(tmpDir, 'markdown/index.md'), 'utf8');
    expect(indexContent).toContain('---');
    expect(indexContent).toContain('title: "TokenContract"');
    expect(indexContent).toContain('# TokenContract');
    expect(indexContent).toContain('transfer');
    expect(indexContent).toContain('balance');
  });

  it('renders function documentation with parameter table', () => {
    const renderer = new MarkdownRenderer({ outputDir: tmpDir });
    renderer.render(makeDocOutput());

    const fnContent = fs.readFileSync(path.join(tmpDir, 'markdown/functions/transfer.md'), 'utf8');
    expect(fnContent).toContain('# transfer');
    expect(fnContent).toContain('The recipient address.');
    expect(fnContent).toContain('The amount to transfer.');
    expect(fnContent).toContain('| Parameter | Type | Description |');
  });

  it('renders error reference with causes and remediation', () => {
    const renderer = new MarkdownRenderer({ outputDir: tmpDir });
    renderer.render(makeDocOutput());

    const errContent = fs.readFileSync(path.join(tmpDir, 'markdown/errors/error-reference.md'), 'utf8');
    expect(errContent).toContain('InsufficientBalance');
    expect(errContent).toContain('Insufficient funds');
    expect(errContent).toContain('Ensure the account has sufficient tokens.');
  });
});

describe('DocusaurusRenderer', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sorodoc-ds-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates docusaurus site scaffolding', () => {
    const renderer = new DocusaurusRenderer({
      outputDir: tmpDir,
      projectName: 'TokenContract',
      tagline: 'A Soroban token contract',
    });
    const output = makeDocOutput();
    const result = renderer.render(output);

    expect(fs.existsSync(path.join(tmpDir, 'docusaurus/docusaurus.config.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docusaurus/sidebars.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docusaurus/src/css/custom.css'))).toBe(true);
  });

  it('generates docusaurus config with correct project name', () => {
    const renderer = new DocusaurusRenderer({
      outputDir: tmpDir,
      projectName: 'TokenContract',
    });
    renderer.render(makeDocOutput());

    const configContent = fs.readFileSync(path.join(tmpDir, 'docusaurus/docusaurus.config.js'), 'utf8');
    expect(configContent).toContain("title: 'TokenContract'");
    expect(configContent).toContain('@docusaurus/preset-classic');
  });

  it('generates sidebars with function references', () => {
    const renderer = new DocusaurusRenderer({
      outputDir: tmpDir,
      projectName: 'TokenContract',
    });
    renderer.render(makeDocOutput());

    const sidebarContent = fs.readFileSync(path.join(tmpDir, 'docusaurus/sidebars.js'), 'utf8');
    expect(sidebarContent).toContain("'functions/transfer'");
    expect(sidebarContent).toContain("'functions/balance'");
    expect(sidebarContent).toContain("'errors/error-reference'");
  });
});

describe('OpenAPIRenderer', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sorodoc-oa-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates OpenAPI spec with function paths', () => {
    const renderer = new OpenAPIRenderer({ outputDir: tmpDir });
    const output = makeDocOutput();
    const result = renderer.render(output);

    expect(result.openapi).toBeDefined();

    const specPath = path.join(tmpDir, 'openapi.yaml');
    expect(fs.existsSync(specPath)).toBe(true);

    const content = fs.readFileSync(specPath, 'utf8');
    expect(content).toContain('openapi');
    expect(content).toContain('/invoke/transfer');
    expect(content).toContain('/invoke/balance');
    expect(content).toContain('InsufficientBalance');
  });

  it('includes server URL based on network option', () => {
    const renderer = new OpenAPIRenderer({
      outputDir: tmpDir,
      network: 'mainnet',
    });
    renderer.render(makeDocOutput());

    const content = fs.readFileSync(path.join(tmpDir, 'openapi.yaml'), 'utf8');
    expect(content).toContain('soroban-rpc.mainnet.stellar.org');
  });

  it('includes error schemas in components', () => {
    const renderer = new OpenAPIRenderer({ outputDir: tmpDir });
    renderer.render(makeDocOutput());

    const content = fs.readFileSync(path.join(tmpDir, 'openapi.yaml'), 'utf8');
    expect(content).toContain('Error_InsufficientBalance');
    expect(content).toContain('"code"');
    expect(content).toContain('"message"');
  });
});
