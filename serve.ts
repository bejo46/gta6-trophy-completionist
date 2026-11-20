// serve.ts — a small static file server for app/, for trying the
// blueprint locally: `node serve.ts` (port 8080) or
// `node serve.ts --port 8123`. Node standard library only. It refuses
// paths that climb out of app/ and answers 404 for anything missing;
// it is a development convenience, not a production server.

import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('./app', import.meta.url));

const argv = process.argv.slice(2);
const portFlag = argv.indexOf('--port');
const port = portFlag >= 0 && Number(argv[portFlag + 1]) > 0 ? Number(argv[portFlag + 1]) : 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const rel = normalize(path).replace(/^[/\\]+/, '');
    if (rel.startsWith('..')) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const file = join(appRoot, rel);
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Leonida Completionist app/ serving at http://localhost:${port}`);
});
