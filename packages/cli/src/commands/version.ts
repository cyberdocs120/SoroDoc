import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { parseContract, type ContractABI } from '@sorodoc/core';

export function getVersionsDir(): string {
  const base = process.env.SORODOC_HOME ? path.resolve(process.env.SORODOC_HOME) : path.resolve('.');
  return path.join(base, '.sorodoc', 'versions');
}

export interface VersionMeta {
  name: string;
  contractId?: string;
  timestamp: string;
  functions: number;
  events: number;
  errors: number;
  functionNames: string[];
  functionSigs: Record<string, string>;
}

export interface TagVersionOptions {
  contractId?: string;
  name?: string;
  wasm?: string;
  source?: string;
}

function ensureVersionsDir(): string {
  const dir = getVersionsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function listVersions(): VersionMeta[] {
  const dir = ensureVersionsDir();
  const versions: VersionMeta[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(dir, entry.name), 'utf8')) as VersionMeta;
          versions.push(data);
        } catch { /* skip corrupt */ }
      }
    }
  } catch { /* empty */ }
  return versions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function findVersion(name: string): VersionMeta | undefined {
  return listVersions().find(v => v.name === name);
}

export function fmtSignature(fn: { name: string; params: Array<{ name: string; type: { kind: string } }>; returns: { kind: string } }): string {
  const params = fn.params.map(p => `${p.name}: ${p.type.kind}`).join(', ');
  return `${fn.name}(${params}) → ${fn.returns.kind}`;
}

function abiToMeta(abi: ContractABI): Pick<VersionMeta, 'functions' | 'events' | 'errors' | 'functionNames' | 'functionSigs'> {
  const functionSigs: Record<string, string> = {};
  for (const fn of abi.functions) {
    functionSigs[fn.name] = fmtSignature(fn);
  }
  return {
    functions: abi.functions.length,
    events: abi.events.length,
    errors: abi.errors.length,
    functionNames: abi.functions.map(fn => fn.name),
    functionSigs,
  };
}

export function tagVersion(versionTag: string, opts: TagVersionOptions = {}): VersionMeta {
  if (!versionTag) {
    throw new Error('Version tag is required');
  }
  const dir = ensureVersionsDir();

  const existing = findVersion(versionTag);
  if (existing) {
    const tagged = existing.timestamp ? ` (tagged ${existing.timestamp})` : '';
    throw new Error(`Version "${versionTag}" already exists${tagged}`);
  }

  const parsed: Pick<VersionMeta, 'functions' | 'events' | 'errors' | 'functionNames' | 'functionSigs'> = {
    functions: 0,
    events: 0,
    errors: 0,
    functionNames: [],
    functionSigs: {},
  };

  if (opts.wasm) {
    const wasmPath = path.resolve(opts.wasm);
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM file not found: ${wasmPath}`);
    }
    const abi = parseContract({
      wasm: fs.readFileSync(wasmPath),
      source: opts.source ? path.resolve(opts.source) : undefined,
      contractName: opts.name,
    });
    Object.assign(parsed, abiToMeta(abi));
  }

  const meta: VersionMeta = {
    name: versionTag,
    contractId: opts.contractId,
    timestamp: new Date().toISOString(),
    ...parsed,
  };

  const filePath = path.join(dir, `${versionTag.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
  fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}

export interface VersionDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export function diffVersions(versionA: string, versionB: string): VersionDiff {
  const vA = findVersion(versionA);
  const vB = findVersion(versionB);

  if (!vA) throw new Error(`Version "${versionA}" not found`);
  if (!vB) throw new Error(`Version "${versionB}" not found`);

  const added = vB.functionNames.filter(f => !vA.functionNames.includes(f));
  const removed = vA.functionNames.filter(f => !vB.functionNames.includes(f));
  const common = vB.functionNames.filter(f => vA.functionNames.includes(f));
  const changed = common.filter(f => vA.functionSigs[f] !== vB.functionSigs[f]);

  return { added, removed, changed };
}

export const versionCommand = new Command('version')
  .description('Manage contract documentation versions')
  .addCommand(
    new Command('tag')
      .description('Tag the current documentation version')
      .argument('<version>', 'Version tag (e.g. 1.0.0)')
      .option('-c, --contract-id <id>', 'Contract ID for this version')
      .option('-n, --name <name>', 'Contract name')
      .option('--wasm <path>', 'Path to compiled WASM binary to capture the real ABI')
      .option('--source <path>', 'Path to Rust source file for doc enrichment')
      .action((versionTag: string, opts: TagVersionOptions) => {
        try {
          const meta = tagVersion(versionTag, opts);
          console.log(`\n  ✅ Tagged version "${versionTag}"`);
          if (meta.contractId) console.log(`  📝 Contract: ${meta.contractId}`);
          console.log(`  📊 ${meta.functions} functions, ${meta.events} events, ${meta.errors} errors`);
          console.log(`  📁 ${path.join(getVersionsDir(), `${versionTag.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`)}\n`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Error: ${message}`);
          process.exit(1);
        }
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
        let diff: VersionDiff;
        try {
          diff = diffVersions(a, b);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Error: ${message}`);
          process.exit(1);
        }

        const vA = findVersion(a)!;
        const vB = findVersion(b)!;
        const { added, removed, changed } = diff;

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
