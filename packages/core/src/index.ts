export { ABIParser } from './parser/ABIParser.js';
export { SourceParser } from './parser/SourceParser.js';
export { EventParser } from './parser/EventParser.js';
export { ErrorParser } from './parser/ErrorParser.js';
export { DocEngine } from './ai/DocEngine.js';
export { FunctionDocWriter } from './ai/FunctionDocWriter.js';
export { ErrorDocWriter } from './ai/ErrorDocWriter.js';
export { EventDocWriter } from './ai/EventDocWriter.js';
export { ExampleGenerator } from './ai/ExampleGenerator.js';
export { ValidationPass } from './ai/ValidationPass.js';
export { MarkdownRenderer } from './renderers/MarkdownRenderer.js';
export { DocusaurusRenderer } from './renderers/DocusaurusRenderer.js';
export { OpenAPIRenderer } from './renderers/OpenAPIRenderer.js';
export { generateTypeScriptSDK, type TypeScriptSDKOptions } from './codegen/TypeScriptSDK.js';
export { generatePythonSDK, type PythonSDKOptions } from './codegen/PythonSDK.js';
export { generateRustClient, type RustClientOptions } from './codegen/RustClient.js';
export {
  fetchContractWasm,
  isValidContractId,
  getRpcUrl,
  NETWORK_RPC_URLS,
  type SorobanNetwork,
  type FetchContractWasmOptions,
} from './net/index.js';
export { ConfigFileSchema, AIPromptConfigSchema, SorobanTypeSchema } from './types.js';
export * from './types.js';

import { ABIParser } from './parser/ABIParser.js';
import { SourceParser } from './parser/SourceParser.js';
import { ContractABI, ParseOptions } from './types.js';

export function parseContract(options: ParseOptions): ContractABI {
  const abiParser = new ABIParser();
  const abi = abiParser.parse({ wasm: options.wasm, contractName: options.contractName });

  if (options.source) {
    const sourceParser = new SourceParser();
    const sourceDocs = sourceParser.parse(options.source);

    // Enrich ABI with source docs
    abi.functions.forEach((fn) => {
      const entry = sourceDocs.functions.get(fn.name);
      if (entry) {
        fn.docs = entry.docs;
        fn.category = entry.category;
        fn.since = entry.since;
        fn.isHighlighted = entry.isHighlighted;
      }
    });

    abi.types.forEach((typeDef) => {
      const entry = sourceDocs.types.get(typeDef.name);
      if (entry) {
        typeDef.docs = entry.docs;
        // If it's a struct/enum, we might want to enrich fields too
        // For now, just top-level docs
      }
    });

    // Enrich events with descriptions from @sorodoc:event / @sorodoc:event-description tags
    abi.events.forEach((evt) => {
      const entry = sourceDocs.events.get(evt.name);
      if (entry?.docs) {
        evt.description = entry.docs;
      }
    });

    // Enrich errors with doc comments from the contract error enum
    abi.errors.forEach((err) => {
      const entry = sourceDocs.errors.get(err.name);
      if (entry?.docs) {
        err.description = entry.docs;
        err.message = entry.docs;
      }
    });
  }

  return abi;
}
