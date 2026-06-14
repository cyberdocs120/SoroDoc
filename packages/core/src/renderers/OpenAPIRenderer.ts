import fs from 'node:fs';
import path from 'node:path';
import { DocOutput, DocFunction, GeneratedOutput, SorobanType } from '../types.js';

export interface OpenAPIRendererOptions {
  outputDir: string;
  contractId?: string;
  network?: string;
  serverUrl?: string;
}

export class OpenAPIRenderer {
  private options: OpenAPIRendererOptions;

  constructor(options: OpenAPIRendererOptions) {
    this.options = options;
  }

  render(output: DocOutput): GeneratedOutput {
    const spec = this.buildSpec(output);
    const baseDir = path.resolve(this.options.outputDir);
    fs.mkdirSync(baseDir, { recursive: true });

    const content = JSON.stringify(spec, null, 2);
    const filePath = path.join(baseDir, 'openapi.json');
    fs.writeFileSync(filePath, content, 'utf8');

    return {
      docs: output,
      openapi: spec,
      markdown: `OpenAPI spec written to ${filePath}`,
    };
  }

  private buildSpec(output: DocOutput): Record<string, unknown> {
    const serverUrl = this.options.serverUrl
      || (this.options.network === 'mainnet'
        ? 'https://soroban-rpc.mainnet.stellar.org'
        : 'https://soroban-rpc.testnet.stellar.org');

    const paths: Record<string, unknown> = {};
    for (const fn of output.functions) {
      paths[`/invoke/${fn.name}`] = this.buildPath(fn);
    }

    return {
      openapi: '3.1.0',
      info: {
        title: `${output.contractName} — Soroban Contract API`,
        version: '1.0.0',
        description: output.overview,
      },
      servers: [{ url: serverUrl, description: this.options.network || 'testnet' }],
      paths,
      components: {
        schemas: this.buildSchemas(output),
      },
    };
  }

  private buildPath(fn: DocFunction): Record<string, unknown> {
    const errorResponses: Record<string, unknown> = {};
    for (const err of fn.errors || []) {
      errorResponses[String(err.code)] = {
        description: err.description,
        content: { 'application/json': { schema: { $ref: `#/components/schemas/Error_${err.name}` } } },
      };
    }

    return {
      post: {
        summary: fn.description.split('\n')[0],
        description: fn.description,
        operationId: fn.name,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: Object.fromEntries(
                  fn.params.map(p => [p.name, this.typeToSchema(p.type)])
                ),
                required: fn.params.map(p => p.name),
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful invocation',
            content: { 'application/json': { schema: this.typeToSchema(fn.returns.type) } },
          },
          ...errorResponses,
          '4xx': { description: 'Contract error' },
        },
      },
    };
  }

  private buildSchemas(output: DocOutput): Record<string, unknown> {
    const schemas: Record<string, unknown> = {};
    for (const err of output.errors) {
      schemas[`Error_${err.name}`] = {
        type: 'object',
        properties: {
          code: { type: 'integer', example: err.code },
          message: { type: 'string', example: err.description },
        },
      };
    }
    return schemas;
  }

  private typeToSchema(type: SorobanType): Record<string, unknown> {
    switch (type.kind) {
      case 'bool':
        return { type: 'boolean' };
      case 'i32':
      case 'u32':
        return { type: 'integer' };
      case 'i64':
      case 'u64':
        return { type: 'integer', format: 'int64' };
      case 'i128':
      case 'u128':
      case 'i256':
      case 'u256':
        return { type: 'string', description: 'Large integer as string' };
      case 'address':
        return { type: 'string', description: 'Stellar address' };
      case 'symbol':
      case 'string':
        return { type: 'string' };
      case 'bytes':
        return { type: 'string', format: 'byte' };
      case 'vec':
        return { type: 'array', items: this.typeToSchema(type.element) };
      case 'map':
        return {
          type: 'object',
          additionalProperties: this.typeToSchema(type.value),
          description: 'Map representation',
        };
      case 'option':
        return { ...this.typeToSchema(type.inner), nullable: true };
      case 'struct':
        return {
          type: 'object',
          properties: Object.fromEntries(
            type.fields.map(f => [f.name, this.typeToSchema(f.type)])
          ),
          required: type.fields.map(f => f.name),
        };
      case 'enum':
        return { type: 'string', enum: type.variants.map(v => v.name) };
      case 'void':
        return { type: 'null' };
      default:
        return { type: 'string' };
    }
  }
}

