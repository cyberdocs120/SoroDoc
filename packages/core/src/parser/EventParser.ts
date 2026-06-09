import { xdr } from '@stellar/stellar-sdk';
import { EventSpec, EventTopic, EventField, SorobanType } from '../types.js';

export class EventParser {
  parse(
    event: xdr.ScSpecEventV0,
    typeConverter: (t: xdr.ScSpecTypeDef) => SorobanType,
    bufToString: (buf: Buffer | string) => string
  ): EventSpec {
    const name = bufToString(event.name());
    const prefixTopics = event.prefixTopics();
    const params = event.params();

    const topicParams = params.filter(
      (p: xdr.ScSpecEventParamV0) => p.location().value === 1,
    );
    const dataParams = params.filter(
      (p: xdr.ScSpecEventParamV0) => p.location().value === 0,
    );

    const topics: EventTopic[] = prefixTopics.map((t: Buffer | string, index: number) => ({
      index,
      name: typeof t === 'string' ? t : t.toString(),
      type: { kind: 'symbol' },
    }));

    topicParams.forEach((p: xdr.ScSpecEventParamV0, i: number) => {
      topics.push({
        index: prefixTopics.length + i,
        name: bufToString(p.name()),
        type: typeConverter(p.type()),
      });
    });

    const data: EventField[] = dataParams.map((p: xdr.ScSpecEventParamV0) => ({
      name: bufToString(p.name()),
      type: typeConverter(p.type()),
    }));

    return { name, topics, data };
  }
}
