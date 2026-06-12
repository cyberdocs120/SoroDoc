import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';

interface DeployOptions {
  dir: string;
  apiKey?: string;
  workspace?: string;
  domain?: string;
}

function findConfig(): Record<string, unknown> | null {
  const candidates = ['sorodoc.config.json', 'sorodoc.json', '.sorodoc/config.json'];
  for (const c of candidates) {
    const p = path.resolve(c);
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
    }
  }
  return null;
}

function formatSizeBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function runDeploy(opts: DeployOptions): Promise<void> {
  const docsDir = path.resolve(opts.dir);

  if (!fs.existsSync(docsDir)) {
    console.error(`Error: Directory not found: ${docsDir}`);
    process.exit(1);
  }

  const config = findConfig();
  const projectName = (config && typeof config === 'object' && 'project' in config
    ? (config.project as Record<string, unknown>)?.name
    : undefined) as string | undefined;

  console.log(`\n  🚀 SoroDoc Portal Deploy\n`);

  // Calculate total size and file count
  let totalSize = 0;
  let fileCount = 0;
  const walkDir = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isFile()) {
        totalSize += fs.statSync(fp).size;
        fileCount++;
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        walkDir(fp);
      }
    }
  };
  walkDir(docsDir);

  console.log(`  📁 Package:  ${projectName || '(not configured)'}`);
  console.log(`  📂 Source:   ${docsDir}`);
  console.log(`  📄 Files:    ${fileCount} (${formatSizeBytes(totalSize)})`);

  if (opts.workspace) {
    console.log(`  🏢 Workspace: ${opts.workspace}`);
  }
  if (opts.domain) {
    console.log(`  🌐 Domain:   ${opts.domain}`);
  }

  if (!opts.apiKey && !process.env.SORODOC_API_KEY) {
    console.log(`\n  ⚠️  No API key provided. Use --api-key or set SORODOC_API_KEY.`);
    console.log(`  Preview mode — no deployment will be made.\n`);

    // Generate a deployment manifest for preview
    const manifest = {
      project: projectName || 'unknown',
      domain: opts.domain || undefined,
      workspace: opts.workspace || undefined,
      files: fileCount,
      totalSize,
      timestamp: new Date().toISOString(),
    };
    const manifestPath = path.join(docsDir, '.sorodoc-deploy.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`  📝 Deployment manifest written to ${manifestPath}\n`);
    return;
  }

  const apiKey = opts.apiKey || process.env.SORODOC_API_KEY || '';

  console.log(`\n  📤 Deploying to SoroDoc portal...`);

  // Stub for actual API call
  console.log(`  ℹ️  Portal deployment API — coming soon`);
  console.log(`  🔑 API key: ${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`);
  console.log(`  📦 Would upload ${fileCount} files (${formatSizeBytes(totalSize)})`);

  console.log(`\n  ✅ Deployment queued (simulated)\n`);
}

export const portalCommand = new Command('portal')
  .description('Manage the SoroDoc hosted portal')
  .addCommand(
    new Command('deploy')
      .description('Deploy documentation to the SoroDoc portal')
      .option('-d, --dir <path>', 'Documentation directory to deploy', './docs')
      .option('--api-key <key>', 'API key for the portal')
      .option('-w, --workspace <name>', 'Workspace name for the portal')
      .option('--domain <domain>', 'Custom domain for hosted docs')
      .action(async (opts: DeployOptions) => {
        await runDeploy(opts);
      }),
  );
