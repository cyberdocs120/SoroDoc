import fs from 'fs';
import path from 'path';

export interface SourceDocs {
  functions: Map<string, DocEntry>;
  types: Map<string, DocEntry>;
  events: Map<string, DocEntry>;
  errors: Map<string, DocEntry>;
}

export interface DocEntry {
  docs?: string;
  category?: string;
  since?: string;
  isHighlighted?: boolean;
  params?: Map<string, string>;
  returns?: string;
  event?: string;
  eventDescription?: string;
}

export class SourceParser {
  parse(sourcePath: string): SourceDocs {
    const content = fs.readFileSync(sourcePath, 'utf8');
    return this.parseContent(content);
  }

  parseContent(content: string): SourceDocs {
    const docs: SourceDocs = {
      functions: new Map(),
      types: new Map(),
      events: new Map(),
      errors: new Map(),
    };

    const lines = content.split('\n');
    let currentDocs: string[] = [];
    let inEnum = false;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (raw === undefined) continue;
      const line = raw.trim();

      if (line.startsWith('///')) {
        currentDocs.push(line.substring(3).trim());
        continue;
      }

      if (currentDocs.length > 0) {
        if (line === '' || line.startsWith('//') || line.startsWith('#[')) {
          continue;
        }
      }

      const enumDecl = line.match(/(?:pub\s+)?enum\s+(\w+)/);
      if (enumDecl && !inEnum) {
        inEnum = true;
      }
      if (inEnum && line.includes('}')) {
        inEnum = false;
      }

      if (currentDocs.length > 0) {
        const entry = this.processDocBlock(currentDocs);

        const fnMatch = line.match(/pub\s+fn\s+(\w+)/);
        if (fnMatch && fnMatch[1]) {
          if (entry.event) {
            docs.events.set(entry.event, { docs: entry.eventDescription || entry.docs });
          }
          docs.functions.set(fnMatch[1], entry);
        } else if (enumDecl && enumDecl[1]) {
          docs.types.set(enumDecl[1], entry);
        } else {
          const structMatch = line.match(/pub\s+struct\s+(\w+)/);
          if (structMatch && structMatch[1]) {
            docs.types.set(structMatch[1], entry);
          } else if (inEnum) {
            const variantMatch = line.match(/^(\w+)/);
            if (variantMatch && variantMatch[1]) {
              docs.errors.set(variantMatch[1], entry);
            }
          }
        }

        currentDocs = [];
      }
    }

    return docs;
  }

  private processDocBlock(lines: string[]): DocEntry {
    const entry: DocEntry = {
      params: new Map(),
    };
    const cleanLines: string[] = [];

    for (const line of lines) {
      if (line.includes('@sorodoc:category')) {
        entry.category = line.split('@sorodoc:category')[1]?.trim() ?? '';
      } else if (line.includes('@sorodoc:since')) {
        entry.since = line.split('@sorodoc:since')[1]?.trim() ?? '';
      } else if (line.includes('@sorodoc:example-highlight')) {
        entry.isHighlighted = true;
      } else if (line.includes('@sorodoc:event-description')) {
        entry.eventDescription = line.split('@sorodoc:event-description')[1]?.trim() ?? '';
      } else if (line.includes('@sorodoc:event')) {
        entry.event = line.split('@sorodoc:event')[1]?.trim().split(/\s+/)[0] ?? '';
      } else {
        cleanLines.push(line);
      }
    }

    entry.docs = cleanLines.join('\n').trim();
    return entry;
  }
}
