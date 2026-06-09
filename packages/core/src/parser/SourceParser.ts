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

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('///')) {
        currentDocs.push(line.substring(3).trim());
        continue;
      }

      if (currentDocs.length > 0) {
        // Look for the next non-empty line that isn't a comment
        if (line === '' || line.startsWith('//') || line.startsWith('#[')) {
             // If it's an attribute or empty line, we might still be before the item
             // But if it's a regular comment //, we might want to skip or include?
             // Rust doc comments /// apply to the item following them.
             continue;
        }

        const entry = this.processDocBlock(currentDocs);
        
        // Try to identify what this doc block belongs to
        const fnMatch = line.match(/pub\s+fn\s+(\w+)/);
        if (fnMatch) {
          docs.functions.set(fnMatch[1], entry);
        } else {
          const structMatch = line.match(/pub\s+struct\s+(\w+)/);
          if (structMatch) {
            docs.types.set(structMatch[1], entry);
          } else {
            const enumMatch = line.match(/pub\s+enum\s+(\w+)/);
            if (enumMatch) {
              docs.types.set(enumMatch[1], entry);
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
        entry.category = line.split('@sorodoc:category')[1].trim();
      } else if (line.includes('@sorodoc:since')) {
        entry.since = line.split('@sorodoc:since')[1].trim();
      } else if (line.includes('@sorodoc:example-highlight')) {
        entry.isHighlighted = true;
      } else {
        cleanLines.push(line);
      }
    }

    entry.docs = cleanLines.join('\n').trim();
    return entry;
  }
}
