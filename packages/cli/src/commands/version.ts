import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';

const VERSIONS_DIR = path.resolve('./.sorodoc/versions');

interface VersionMeta {
  name: string;
  contractId?: string;
  timestamp: string;
  functions: number;
  events: number;
  errors: number;
  functionNames: string[];
  functionSigs: Record<string, string>;
}

function ensureVersionsDir(): string {
  fs.mkdirSync(VERSIONS_DIR, { recursive: true });
  return VERSIONS_DIR;
}

function listVersions(): VersionMeta[] {
  ensureVersionsDir();
  const versions: VersionMeta[] = [];
  try {
    for (const entry of fs.readdirSync(VERSIONS_DIR, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(VERSIONS_DIR, entry.name), 'utf8')) as VersionMeta;
          versions.push(data);
        } catch { /* skip corrupt */ }
      }
    }
  } catch { /* empty */ }
  return versions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function findVersion(name: string): VersionMeta | undefined {
  return listVersions().find(v => v.name === name);
}

function fmtSignature(fn: { name: string; params: Array<{ name: string; type: { kind: string } }>; returns: { kind: string } }): string {
  const params = fn.params.map(p => `${p.name}: ${p.type.kind}`).join(', ');
  return `${fn.name}(${params}) → ${fn.returns.kind}`;
}

export const versionCommand = new Command('version')
  .description('Manage contract documentation versions')
  .addCommand(
    new Command('tag')
      .description('Tag the current documentation version')
      .argument('<version>', 'Version tag (e.g. 1.0.0)')
      .option('-c, --contract-id <id>', 'Contract ID for this version')
      .option('-n, --name <name>', 'Contract name')
      .action((versionTag: string, opts: { contractId?: string; name?: string }) => {
        const dir = ensureVersionsDir();
        const name = opts.name || versionTag;

        const existing = findVersion(versionTag);
        if (existing) {
          const tagged = existing.timestamp ? ` (tagged ${existing.timestamp})` : '';
      console.error(`Error: Version "${versionTag}" already exists${tagged}`);
          process.exit(1);
        }

        const meta: VersionMeta = {
          name: versionTag,
          contractId: opts.contractId,
          timestamp: new Date().toISOString(),
          functions: 0,
          events: 0,
          errors: 0,
          functionNames: [],
          functionSigs: {},
        };

        const filePath = path.join(dir, `${versionTag.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
        fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf8');
        console.log(`\n  ✅ Tagged version "${versionTag}"`);
        if (opts.contractId) console.log(`  📝 Contract: ${opts.contractId}`);
        console.log(`  📁 ${filePath}\n`);
      }),
  )
  .addCommand(
    new Command('list')
      .description('List all documentation versions')
      .action(() => {
        const versions = listVersions();
        if (versions.length === 0) {
          console.log('No versions tagged yet.');
          console.log('Use `sorodoc version tag <version>` to create one.');
          return;
        }
        console.log(`\n  📋 Documented versions (${versions.length}):\n`);
        for (const v of versions) {
          const date = new Date(v.timestamp).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });
          console.log(`  ${v.name}`);
          console.log(`     Tagged: ${date}`);
          if (v.contractId) console.log(`     Contract: ${v.contractId}`);
          console.log(`     ${v.functions} functions, ${v.events} events, ${v.errors} errors`);
          console.log('');
        }
      }),
  )
  .addCommand(
    new Command('diff')
      .description('Show diff between two contract versions')
      .argument('<version-a>', 'First version')
      .argument('<version-b>', 'Second version')
      .action((a: string, b: string) => {
        const vA = findVersion(a);
        const vB = findVersion(b);

        if (!vA) { console.error(`Error: Version "${a}" not found`); process.exit(1); }
        if (!vB) { console.error(`Error: Version "${b}" not found`); process.exit(1); }

        const added = vB.functionNames.filter(f => !vA.functionNames.includes(f));
        const removed = vA.functionNames.filter(f => !vB.functionNames.includes(f));
        const common = vB.functionNames.filter(f => vA.functionNames.includes(f));
        const changed = common.filter(f => vA.functionSigs[f] !== vB.functionSigs[f]);

        console.log(`\n  📋 API Changes: ${a} → ${b}\n`);

        if (added.length === 0 && removed.length === 0 && changed.length === 0) {
          console.log('  No changes detected between versions.');
          return;
        }

        for (const fn of added) {
          console.log(`  ✅ Added:    ${vB.functionSigs[fn] || fn}`);
        }
        for (const fn of changed) {
          console.log(`  ⚠️  Changed:  ${vA.functionSigs[fn]} → ${vB.functionSigs[fn]}`);
        }
        for (const fn of removed) {
          console.log(`  ❌ Removed:  ${vA.functionSigs[fn] || fn}`);
        }

        if (removed.length > 0 || (added.length > 0 && removed.length > 0)) {
          console.log(`\n  ⚠️  Breaking changes detected. Consider a migration guide.`);
        }

        console.log('');
      }),
  );
