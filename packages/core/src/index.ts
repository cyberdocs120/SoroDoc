export * from './types.js';
export { ABIParser } from './parser/ABIParser.js';
export { SourceParser } from './parser/SourceParser.js';
export { EventParser } from './parser/EventParser.js';
export { ErrorParser } from './parser/ErrorParser.js';
export { DocEngine } from './ai/DocEngine.js';
export { FunctionDocWriter } from './ai/FunctionDocWriter.js';
export { ErrorDocWriter } from './ai/ErrorDocWriter.js';
export { ExampleGenerator } from './ai/ExampleGenerator.js';
export { ValidationPass } from './ai/ValidationPass.js';
export { MarkdownRenderer } from './renderers/MarkdownRenderer.js';
export { DocusaurusRenderer } from './renderers/DocusaurusRenderer.js';
export { OpenAPIRenderer } from './renderers/OpenAPIRenderer.js';

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
    abi.functions.forEach(fn => {
      const entry = sourceDocs.functions.get(fn.name);
      if (entry) {
        fn.docs = entry.docs;
        fn.category = entry.category;
        fn.since = entry.since;
        fn.isHighlighted = entry.isHighlighted;
      }
    });

    abi.types.forEach(typeDef => {
      const entry = sourceDocs.types.get(typeDef.name);
      if (entry) {
        typeDef.docs = entry.docs;
        // If it's a struct/enum, we might want to enrich fields too
        // For now, just top-level docs
      }
    });

    // TODO: Enrich events and errors if they can be mapped from source
  }

  return abi;
}
