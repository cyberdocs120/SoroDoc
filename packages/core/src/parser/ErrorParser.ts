import { xdr } from '@stellar/stellar-sdk';
import { ErrorSpec } from '../types.js';

export class ErrorParser {
  parse(
    errorEnum: xdr.ScSpecUdtErrorEnumV0,
    bufToString: (buf: Buffer | string) => string
  ): ErrorSpec[] {
    const cases = errorEnum.cases();
    return cases.map((c: xdr.ScSpecUdtErrorEnumCaseV0) => ({
      code: c.value(),
      name: bufToString(c.name()),
      // Messages and descriptions might be enriched later via SourceParser or AI
    }));
  }
}
