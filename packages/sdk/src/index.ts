import fs from 'node:fs';
import path from 'node:path';
import {
  parseContract,
  generateTypeScriptSDK,
  generatePythonSDK,
  generateRustClient,
  generateReactHooks,
  DocEngine,
  MarkdownRenderer,
  OpenAPIRenderer,
  fetchContractWasm,
  type ContractABI,
  type DocOutput,
  type SDKOutput,
  type AIPromptConfig,
} from '@sorodoc/core';

export type SDKLanguage = 'typescript' | 'python' | 'rust' | 'react';
export type SoroDocNetwork = 'testnet' | 'mainnet';

export interface SDKGeneratorOptions {
  abi: ContractABI;
  docOutput?: DocOutput;
  packageName?: string;
  version?: string;
  network?: string;
  contractId?: string;
  language?: SDKLanguage;
}

export interface SoroDocOptions {
  anthropicApiKey?: string;
}

export interface GenerateDocsOptions {
  wasm: Buffer;
  source?: string;
  contractName: string;
  options?: {
    generateExamples?: boolean;
    exampleLanguages?: string[];
    sdks?: string[];
    openapi?: boolean;
    ai?: Partial<AIPromptConfig>;
  };
}

export interface WriteToResult {
  docs: DocOutput;
  sdk: Record<string, SDKOutput>;
  openapi: Record<string, unknown> | null;
  markdown: string;
}

export interface SoroDocResult {
  contractName: string;
  docs: DocOutput & { markdown: string };
  markdownFiles: Map<string, string>;
  sdk: Record<string, SDKOutput>;
  openapi: Record<string, unknown> | null;
  functions: ContractABI['functions'];
  events: ContractABI['events'];
  errors: ContractABI['errors'];
  writeTo: (dir: string) => Promise<WriteToResult>;
}

const DEFAULT_AI_CONFIG: AIPromptConfig = {
  enabled: true,
  model: 'claude-sonnet-4-20250514',
  tone: 'technical',
  generateExamples: false,
  exampleLanguages: [],
};

export class SDKGenerator {
  private options: SDKGeneratorOptions;

  constructor(options: SDKGeneratorOptions) {
    this.options = options;
  }

  generate(lang?: SDKLanguage): SDKOutput {
    const opts = { ...this.options, language: lang || this.options.language || 'typescript' };

    switch (opts.language) {
      case 'typescript':
        return generateTypeScriptSDK({
          abi: opts.abi,
          docOutput: opts.docOutput,
          packageName: opts.packageName || `@sorodoc/${opts.abi.name.toLowerCase()}-sdk`,
          version: opts.version,
          network: opts.network,
          contractId: opts.contractId,
        });
      case 'python':
        return generatePythonSDK({
          abi: opts.abi,
          docOutput: opts.docOutput,
          packageName: opts.packageName || `${opts.abi.name.toLowerCase()}-sdk`,
          version: opts.version,
          network: opts.network,
          contractId: opts.contractId,
        });
      case 'rust':
        return generateRustClient({
          abi: opts.abi,
          docOutput: opts.docOutput,
          packageName: opts.packageName || `${opts.abi.name.toLowerCase()}-client`,
          version: opts.version,
          network: opts.network,
          contractId: opts.contractId,
        });
      case 'react':
        return generateReactHooks({
          abi: opts.abi,
          docOutput: opts.docOutput,
          packageName: opts.packageName || `@sorodoc/${opts.abi.name.toLowerCase()}-react`,
          version: opts.version,
          network: opts.network,
          contractId: opts.contractId,
        });
      default:
        throw new Error(`Unsupported language: ${opts.language}`);
    }
  }
}

export class SoroDoc {
  private options: SoroDocOptions;

  constructor(options: SoroDocOptions = {}) {
    this.options = options;
  }

  async generate(opts: GenerateDocsOptions): Promise<SoroDocResult> {
    const abi = parseContract({
      wasm: opts.wasm,
      source: opts.source,
      contractName: opts.contractName,
    });

    const aiConfig: AIPromptConfig = {
      ...DEFAULT_AI_CONFIG,
      generateExamples: opts.options?.generateExamples ?? false,
      exampleLanguages: opts.options?.exampleLanguages ?? [],
      ...(opts.options?.ai || {}),
    };

    const engine = new DocEngine({ apiKey: this.options.anthropicApiKey });
    const docOutput = await engine.generate(abi, aiConfig);

    const sdkResults: Record<string, SDKOutput> = {};
    for (const lang of opts.options?.sdks || []) {
      const generator = new SDKGenerator({
        abi,
        docOutput,
        packageName: `@sorodoc/${opts.contractName.toLowerCase()}-sdk`,
        language: lang as SDKLanguage,
      });
      sdkResults[lang] = generator.generate();
    }

    const markdownFiles = new MarkdownRenderer({ outputDir: '' }).buildFiles(docOutput);
    const markdown = markdownFiles.get('index.md') || '';
    const openapi = opts.options?.openapi === false
      ? null
      : new OpenAPIRenderer({ outputDir: '' }).buildSpec(docOutput);

    const result: SoroDocResult = {
      contractName: opts.contractName,
      docs: { ...docOutput, markdown },
      markdownFiles,
      sdk: sdkResults,
      openapi,
      functions: abi.functions,
      events: abi.events,
      errors: abi.errors,
      writeTo: async (dir: string): Promise<WriteToResult> => {
        const outDir = path.resolve(dir);
        fs.mkdirSync(outDir, { recursive: true });

        const mdRenderer = new MarkdownRenderer({ outputDir: outDir });
        const mdResult = mdRenderer.render(docOutput);

        for (const [lang, sdkOutput] of Object.entries(sdkResults)) {
          const sdkDir = path.join(outDir, 'sdk', lang);
          for (const [file, content] of sdkOutput.files) {
            const full = path.join(sdkDir, file);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, content, 'utf8');
          }
          if (sdkOutput.readme) {
            fs.writeFileSync(path.join(sdkDir, 'README.md'), sdkOutput.readme, 'utf8');
          }
        }

        if (openapi) {
          fs.writeFileSync(path.join(outDir, 'openapi.json'), JSON.stringify(openapi, null, 2), 'utf8');
        }

        return { docs: docOutput, sdk: sdkResults, openapi, markdown: mdResult.markdown ?? '' };
      },
    };

    return result;
  }

  async generateFromDeployed(opts: {
    contractId: string;
    network: SoroDocNetwork;
    contractName: string;
    options?: GenerateDocsOptions['options'];
    rpcUrl?: string;
  }): Promise<SoroDocResult> {
    const wasm = await fetchContractWasm({
      contractId: opts.contractId,
      network: opts.network,
      rpcUrl: opts.rpcUrl,
    });

    return this.generate({
      wasm,
      contractName: opts.contractName,
      options: opts.options,
    });
  }
}
