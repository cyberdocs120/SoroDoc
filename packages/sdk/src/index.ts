import {
  parseContract,
  generateTypeScriptSDK,
  generatePythonSDK,
  generateRustClient,
  type ContractABI,
  type DocOutput,
  type SDKOutput,
} from '@sorodoc/core';

export type SDKLanguage = 'typescript' | 'python' | 'rust';

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
  };
}

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

  generate(opts: GenerateDocsOptions) {
    const abi = parseContract({
      wasm: opts.wasm,
      source: opts.source,
      contractName: opts.contractName,
    });

    const sdks = opts.options?.sdks || [];
    const sdkResults: Record<string, SDKOutput> = {};

    for (const lang of sdks) {
      const generator = new SDKGenerator({
        abi,
        packageName: `@sorodoc/${opts.contractName.toLowerCase()}-sdk`,
        language: lang as SDKLanguage,
      });
      sdkResults[lang] = generator.generate();
    }

    return {
      functions: abi.functions,
      docs: { markdown: '' },
      sdk: sdkResults,
      openapi: null,
    };
  }

  generateFromDeployed(opts: { contractId: string; network: string; contractName: string; options?: { sdks?: string[] } }) {
    throw new Error('Live contract fetching not yet implemented');
  }
}
