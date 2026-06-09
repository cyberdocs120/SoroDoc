import { xdr, cereal } from '@stellar/stellar-sdk';
import type {
  ContractABI,
  FunctionSpec,
  FunctionParam,
  SorobanType,
  EventSpec,
  EventTopic,
  EventField,
  ErrorSpec,
  TypeDefinition,
} from '../types.js';
import { EventParser } from './EventParser.js';
import { ErrorParser } from './ErrorParser.js';

export class ABIParser {
  private eventParser = new EventParser();
  private errorParser = new ErrorParser();

  parse(options: { wasm: Buffer; contractName?: string }): ContractABI {
    const specEntries = this.extractSpecEntries(options.wasm);
    return this.convertToABI(specEntries, options.contractName);
  }

  private extractSpecEntries(wasm: Buffer): xdr.ScSpecEntry[] {
    const data = this.findCustomSection(wasm, 'contractspecv0')
      ?? this.findCustomSection(wasm, 'contractspec');
    if (!data) {
      throw new Error(
        'No contractspec custom section found in WASM binary. ' +
          'Ensure the contract was compiled with --features soroban-sdk.',
      );
    }
    return this.decodeSpecEntries(data);
  }

  private findCustomSection(wasm: Buffer, name: string): Buffer | null {
    let offset = 8;
    while (offset < wasm.length) {
      const sectionId = wasm.readUInt8(offset);
      offset += 1;
      if (offset >= wasm.length) break;

      const sectionLen = this.readLEB128(wasm, offset);
      offset += sectionLen.bytesRead;
      const sectionEnd = offset + sectionLen.value;

      if (sectionId === 0) {
        const nameLen = this.readLEB128(wasm, offset);
        offset += nameLen.bytesRead;
        const sectionName = wasm.subarray(offset, offset + nameLen.value).toString('utf8');
        offset += nameLen.value;

        if (sectionName === name) {
          return wasm.subarray(offset, sectionEnd);
        }
      }
      offset = sectionEnd;
      if (offset > wasm.length) break;
    }
    return null;
  }

  private readLEB128(buf: Buffer, offset: number): { value: number; bytesRead: number } {
    let result = 0;
    let shift = 0;
    let bytesRead = 0;
    while (bytesRead < 5) {
      if (offset + bytesRead >= buf.length) break;
      const byte = buf.readUInt8(offset + bytesRead);
      result |= (byte & 0x7f) << shift;
      shift += 7;
      bytesRead++;
      if (!(byte & 0x80)) break;
    }
    return { value: result, bytesRead };
  }

  private decodeSpecEntries(data: Buffer): xdr.ScSpecEntry[] {
    const entries: xdr.ScSpecEntry[] = [];
    const reader = new cereal.XdrReader(data);
    while (!reader.eof) {
      entries.push((xdr.ScSpecEntry as unknown as { read: (r: typeof reader) => xdr.ScSpecEntry }).read(reader));
    }
    return entries;
  }

  private convertToABI(entries: xdr.ScSpecEntry[], contractName?: string): ContractABI {
    const functions: FunctionSpec[] = [];
    const events: EventSpec[] = [];
    const errors: ErrorSpec[] = [];
    const types: TypeDefinition[] = [];

    for (const entry of entries) {
      switch (entry.switch().value) {
        case 0: {
          functions.push(this.convertFunction(entry.functionV0()));
          break;
        }
        case 1: {
          types.push(this.convertStruct(entry.udtStructV0()));
          break;
        }
        case 2: {
          types.push(this.convertUnion(entry.udtUnionV0()));
          break;
        }
        case 3: {
          types.push(this.convertEnum(entry.udtEnumV0()));
          break;
        }
        case 4: {
          errors.push(...this.errorParser.parse(entry.udtErrorEnumV0(), this.bufToString.bind(this)));
          break;
        }
        case 5: {
          events.push(this.eventParser.parse(entry.eventV0(), this.convertTypeDef.bind(this), this.bufToString.bind(this)));
          break;
        }
      }
    }

    return { name: contractName ?? 'Unknown', functions, events, errors, types };
  }

  private convertFunction(func: xdr.ScSpecFunctionV0): FunctionSpec {
    const name = this.bufToString(func.name());
    const inputs = func.inputs();
    const outputs = func.outputs();

    const params: FunctionParam[] = inputs.map((input: xdr.ScSpecFunctionInputV0) => ({
      name: this.bufToString(input.name()),
      type: this.convertTypeDef(input.type()),
    }));

    return {
      name,
      params,
      returns: outputs.length > 0 ? this.convertTypeDef(outputs[0]!) : { kind: 'void' },
    };
  }

  private convertStruct(struct: xdr.ScSpecUdtStructV0): TypeDefinition {
    const name = this.bufToString(struct.name());
    const fields = struct.fields();
    return {
      name,
      type: {
        kind: 'struct',
        name,
        fields: fields.map((f: xdr.ScSpecUdtStructFieldV0) => ({
          name: this.bufToString(f.name()),
          type: this.convertTypeDef(f.type()),
        })),
      },
    };
  }

  private convertUnion(union_: xdr.ScSpecUdtUnionV0): TypeDefinition {
    const name = this.bufToString(union_.name());
    const cases = union_.cases();
    return {
      name,
      type: {
        kind: 'union',
        name,
        cases: cases.map((c: xdr.ScSpecUdtUnionCaseV0) => ({
          name: this.getUnionCaseName(c),
          type: this.convertUnionCaseType(c),
        })),
      },
    };
  }

  private getUnionCaseName(c: xdr.ScSpecUdtUnionCaseV0): string {
    switch (c.switch().value) {
      case 0:
        return this.bufToString(c.voidCase().name());
      case 1:
        return this.bufToString(c.tupleCase().name());
      default:
        return '';
    }
  }

  private convertUnionCaseType(c: xdr.ScSpecUdtUnionCaseV0): SorobanType {
    switch (c.switch().value) {
      case 0:
        return { kind: 'void' };
      case 1: {
        const tupleCase = c.tupleCase();
        const types = tupleCase.type();
        if (types.length === 1) {
          return this.convertTypeDef(types[0]!);
        }
        return {
          kind: 'tuple',
          elements: types.map((t: xdr.ScSpecTypeDef) => this.convertTypeDef(t)),
        };
      }
      default:
        return { kind: 'void' };
    }
  }

  private convertEnum(enum_: xdr.ScSpecUdtEnumV0): TypeDefinition {
    const name = this.bufToString(enum_.name());
    const cases = enum_.cases();
    return {
      name,
      type: {
        kind: 'enum',
        name,
        variants: cases.map((c: xdr.ScSpecUdtEnumCaseV0) => ({
          name: this.bufToString(c.name()),
        })),
      },
    };
  }

  convertTypeDef(typeDef: xdr.ScSpecTypeDef): SorobanType {
    const switchVal = typeDef.switch().value;

    switch (switchVal) {
      case 0:   return { kind: 'val' };
      case 1:   return { kind: 'bool' };
      case 2:   return { kind: 'void' };
      case 3:   return { kind: 'error' };
      case 4:   return { kind: 'u32' };
      case 5:   return { kind: 'i32' };
      case 6:   return { kind: 'u64' };
      case 7:   return { kind: 'i64' };
      case 8:   return { kind: 'timepoint' };
      case 9:   return { kind: 'duration' };
      case 10:  return { kind: 'u128' };
      case 11:  return { kind: 'i128' };
      case 12:  return { kind: 'u256' };
      case 13:  return { kind: 'i256' };
      case 14:  return { kind: 'bytes' };
      case 16:  return { kind: 'string' };
      case 17:  return { kind: 'symbol' };
      case 19:  return { kind: 'address' };
      case 20:  return { kind: 'muxedAddress' };
      case 1000: {
        const inner = typeDef.option();
        return { kind: 'option', inner: this.convertTypeDef(inner.valueType()) };
      }
      case 1001: {
        const result = typeDef.result();
        return {
          kind: 'result',
          ok: this.convertTypeDef(result.okType()),
          error: this.convertTypeDef(result.errorType()),
        };
      }
      case 1002: {
        const vec = typeDef.vec();
        return { kind: 'vec', element: this.convertTypeDef(vec.elementType()) };
      }
      case 1004: {
        const map = typeDef.map();
        return {
          kind: 'map',
          key: this.convertTypeDef(map.keyType()),
          value: this.convertTypeDef(map.valueType()),
        };
      }
      case 1005: {
        const tuple = typeDef.tuple();
        return {
          kind: 'tuple',
          elements: tuple.valueTypes().map((t: xdr.ScSpecTypeDef) => this.convertTypeDef(t)),
        };
      }
      case 1006: {
        const bytesN = typeDef.bytesN();
        return { kind: 'bytes', len: bytesN.n() };
      }
      case 2000: {
        const udt = typeDef.udt();
        return { kind: 'udt', name: this.bufToString(udt.toString()) };
      }
      default:
        return { kind: 'val' };
    }
  }

  private bufToString(buf: Buffer | string): string {
    if (typeof buf === 'string') return buf;
    return buf.toString('utf8');
  }
}
