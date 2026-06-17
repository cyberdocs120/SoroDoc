import { z } from 'zod';

export const SorobanTypeSchema: z.ZodType<SorobanType> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal('val') }),
    z.object({ kind: z.literal('address') }),
    z.object({ kind: z.literal('bool') }),
    z.object({ kind: z.literal('void') }),
    z.object({ kind: z.literal('error') }),
    z.object({ kind: z.literal('i32') }),
    z.object({ kind: z.literal('i64') }),
    z.object({ kind: z.literal('i128') }),
    z.object({ kind: z.literal('i256') }),
    z.object({ kind: z.literal('u32') }),
    z.object({ kind: z.literal('u64') }),
    z.object({ kind: z.literal('u128') }),
    z.object({ kind: z.literal('u256') }),
    z.object({ kind: z.literal('symbol') }),
    z.object({ kind: z.literal('string') }),
    z.object({ kind: z.literal('timepoint') }),
    z.object({ kind: z.literal('duration') }),
    z.object({ kind: z.literal('bytes'), len: z.number().optional() }),
    z.object({ kind: z.literal('vec'), element: SorobanTypeSchema }),
    z.object({ kind: z.literal('map'), key: SorobanTypeSchema, value: SorobanTypeSchema }),
    z.object({ kind: z.literal('option'), inner: SorobanTypeSchema }),
    z.object({ kind: z.literal('result'), ok: SorobanTypeSchema, error: SorobanTypeSchema }),
    z.object({ kind: z.literal('tuple'), elements: z.array(SorobanTypeSchema) }),
    z.object({
      kind: z.literal('struct'),
      name: z.string(),
      fields: z.array(
        z.object({
          name: z.string(),
          type: SorobanTypeSchema,
          docs: z.string().optional(),
        }),
      ),
    }),
    z.object({
      kind: z.literal('enum'),
      name: z.string(),
      variants: z.array(
        z.object({
          name: z.string(),
          value: z.number().optional(),
          docs: z.string().optional(),
        }),
      ),
    }),
    z.object({
      kind: z.literal('union'),
      name: z.string(),
      cases: z.array(
        z.object({
          name: z.string(),
          type: SorobanTypeSchema,
          docs: z.string().optional(),
        }),
      ),
    }),
    z.object({ kind: z.literal('udt'), name: z.string() }),
    z.object({ kind: z.literal('muxedAddress') }),
  ]),
);

export const AIPromptConfigSchema = z.object({
  enabled: z.boolean().default(true),
  model: z.string().default('claude-sonnet-4-20250514'),
  tone: z.enum(['technical', 'friendly', 'enterprise', 'educational']).default('technical'),
  generateExamples: z.boolean().default(true),
  exampleLanguages: z.array(z.string()).default(['typescript', 'python', 'rust']),
  customInstructions: z.string().optional(),
  glossary: z.record(z.string(), z.string()).optional(),
});

export const ConfigFileSchema = z.object({
  project: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    logo: z.string().optional(),
    primaryColor: z.string().optional(),
  }),
  contracts: z.array(
    z.object({
      name: z.string(),
      source: z.string().optional(),
      wasm: z.string().optional(),
      deployedId: z
        .object({
          testnet: z.string().optional(),
          mainnet: z.string().optional(),
        })
        .optional(),
      visibility: z.enum(['public', 'internal']).default('public'),
      allowedRoles: z.array(z.string()).optional(),
    }),
  ),
  ai: AIPromptConfigSchema.optional(),
  output: z
    .object({
      formats: z.array(z.string()).optional(),
      sdks: z.array(z.string()).optional(),
      outputDir: z.string().optional(),
      openapi: z.boolean().optional(),
    })
    .optional(),
});

export type SorobanType =
  | { kind: 'val' }
  | { kind: 'address' }
  | { kind: 'bool' }
  | { kind: 'void' }
  | { kind: 'error' }
  | { kind: 'i32' }
  | { kind: 'i64' }
  | { kind: 'i128' }
  | { kind: 'i256' }
  | { kind: 'u32' }
  | { kind: 'u64' }
  | { kind: 'u128' }
  | { kind: 'u256' }
  | { kind: 'symbol' }
  | { kind: 'string' }
  | { kind: 'timepoint' }
  | { kind: 'duration' }
  | { kind: 'bytes'; len?: number }
  | { kind: 'vec'; element: SorobanType }
  | { kind: 'map'; key: SorobanType; value: SorobanType }
  | { kind: 'option'; inner: SorobanType }
  | { kind: 'result'; ok: SorobanType; error: SorobanType }
  | { kind: 'tuple'; elements: SorobanType[] }
  | { kind: 'struct'; name: string; fields: StructField[] }
  | { kind: 'enum'; name: string; variants: EnumVariant[] }
  | { kind: 'union'; name: string; cases: UnionCase[] }
  | { kind: 'udt'; name: string }
  | { kind: 'muxedAddress' };

export interface StructField {
  name: string;
  type: SorobanType;
  docs?: string;
}

export interface EnumVariant {
  name: string;
  value?: number;
  docs?: string;
}

export interface UnionCase {
  name: string;
  type: SorobanType;
  docs?: string;
}

export interface FunctionParam {
  name: string;
  type: SorobanType;
  docs?: string;
}

export interface FunctionSpec {
  name: string;
  params: FunctionParam[];
  returns: SorobanType;
  docs?: string;
  category?: string;
  since?: string;
  isHighlighted?: boolean;
}

export interface EventTopic {
  index: number;
  name: string;
  type: SorobanType;
  docs?: string;
}

export interface EventField {
  name: string;
  type: SorobanType;
  docs?: string;
}

export interface EventSpec {
  name: string;
  description?: string;
  topics: EventTopic[];
  data: EventField[];
}

export interface ErrorSpec {
  code: number;
  name: string;
  message?: string;
  description?: string;
  commonCauses?: string[];
  remediation?: string;
}

export interface TypeDefinition {
  name: string;
  type: SorobanType;
  docs?: string;
}

export interface ContractABI {
  name: string;
  version?: string;
  functions: FunctionSpec[];
  events: EventSpec[];
  errors: ErrorSpec[];
  types: TypeDefinition[];
}

export interface DocFunction {
  name: string;
  description: string;
  params: Array<{
    name: string;
    type: SorobanType;
    description: string;
    examples?: string[];
  }>;
  returns: {
    type: SorobanType;
    description: string;
  };
  errors?: Array<{
    code: number;
    name: string;
    description: string;
  }>;
  examples?: Array<{
    language: string;
    code: string;
  }>;
}

export interface DocEvent {
  name: string;
  description: string;
  topics: EventTopic[];
  data: EventField[];
  example?: string;
}

export interface DocError {
  code: number;
  name: string;
  description: string;
  commonCauses: string[];
  remediation: string;
}

export interface DocOutput {
  contractName: string;
  overview: string;
  functions: DocFunction[];
  events: DocEvent[];
  errors: DocError[];
  sdkQuickstart?: string;
}

export interface SDKOutput {
  files: Map<string, string>;
  packageJson?: Record<string, unknown>;
  readme?: string;
}

export interface GeneratedOutput {
  docs: DocOutput;
  sdk?: SDKOutput;
  openapi?: Record<string, unknown>;
  markdown?: string;
}

export interface ParseOptions {
  wasm: Buffer;
  source?: string;
  contractName?: string;
}

export interface AIPromptConfig {
  enabled: boolean;
  model: string;
  tone: 'technical' | 'friendly' | 'enterprise' | 'educational';
  generateExamples: boolean;
  exampleLanguages: string[];
  customInstructions?: string;
  glossary?: Record<string, string>;
}

export interface GenerateOptions {
  contractName: string;
  ai?: AIPromptConfig;
  formats?: string[];
  sdks?: string[];
  outputDir?: string;
}

export interface ConfigFile {
  project: {
    name: string;
    version: string;
    description: string;
    logo?: string;
    primaryColor?: string;
  };
  contracts: Array<{
    name: string;
    source?: string;
    wasm?: string;
    deployedId?: {
      testnet?: string;
      mainnet?: string;
    };
    visibility?: 'public' | 'internal';
    allowedRoles?: string[];
  }>;
  ai?: AIPromptConfig;
  output?: {
    formats?: string[];
    sdks?: string[];
    outputDir?: string;
    openapi?: boolean;
  };
}
