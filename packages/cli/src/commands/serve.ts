import fs from 'node:fs';
import path from 'node:path';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { Command } from 'commander';

interface ServeOptions {
  dir: string;
  port: string;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
};

function serveDir(baseDir: string, port: number): void {
  const resolved = path.resolve(baseDir);

  if (!fs.existsSync(resolved)) {
    console.error(`Error: Directory not found: ${resolved}`);
    process.exit(1);
  }

  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    let reqPath = new URL(req.url || '/', `http://localhost:${port}`).pathname;

    if (reqPath === '/' || reqPath === '/index.html') {
      const indexFiles = ['index.html', 'index.md', 'index.htm'];
      for (const idx of indexFiles) {
        const idxPath = path.join(resolved, idx);
        if (fs.existsSync(idxPath)) {
          reqPath = '/' + idx;
          break;
        }
      }
      if (reqPath === '/' || reqPath === '/index.html') {
        reqPath = '/';
      }
    }

    const filePath = path.join(resolved, reqPath);

    if (!filePath.startsWith(resolved)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        if (reqPath === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(generateDirListing(resolved, '/'));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on('error', () => {
        res.writeHead(500);
        res.end('Internal server error');
      });
    });
  });

  server.listen(port, () => {
    const urls = [
      `http://localhost:${port}`,
      port === 80 ? '' : `http://127.0.0.1:${port}`,
    ].filter(Boolean);

    console.log(`\n  🖥  SoroDoc documentation server\n`);
    console.log(`  Local:   ${urls[0]}`);
    if (urls[1]) console.log(`  Network: ${urls[1]}`);
    console.log(`\n  Serving: ${resolved}`);
    console.log(`  Press Ctrl+C to stop\n`);
  });
}

function generateDirListing(baseDir: string, urlPath: string): string {
  const items: string[] = [];
  try {
    for (const entry of fs.readdirSync(path.join(baseDir, urlPath), { withFileTypes: true })) {
      const name = entry.name;
      const href = path.join(urlPath, name);
      const suffix = entry.isDirectory() ? '/' : '';
      items.push(`<li><a href="${href}">${name}${suffix}</a></li>`);
    }
  } catch { /* empty */ }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>SoroDoc Docs</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:800px;margin:40px auto;padding:0 20px}
h1{font-size:1.5rem;color:#333}ul{list-style:none;padding:0}li{padding:4px 0}
a{color:#4f46e5;text-decoration:none}a:hover{text-decoration:underline}</style>
</head>
<body><h1>📄 SoroDoc Documentation</h1><ul>${items.join('')}</ul></body>
</html>`;
}

export const serveCommand = new Command('serve')
  .description('Serve generated documentation locally')
  .option('-d, --dir <path>', 'Documentation directory to serve', './docs')
  .option('-p, --port <port>', 'Port to serve on', '3000')
  .action(async (opts: ServeOptions) => {
    serveDir(opts.dir, parseInt(opts.port, 10));
  });
