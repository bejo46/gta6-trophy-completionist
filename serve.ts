// serve.ts — a small static file server for app/, for local testing and
// screenshots. Node standard library only.
//
//   node serve.ts [--port <n>]     (default port 8093)
//
// It serves files from app/ only, answers 404 for anything missing, and
// refuses paths that try to escape the app/ directory.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));

const argv = process.argv.slice(2);
const portFlag = argv.indexOf('--port');
const parsed = portFlag >= 0 ? Number(argv[portFlag + 1]) : NaN;
const port = Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 8093;

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

const server = createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = resolve(join(appRoot, normalize(pathname)));
  if (filePath !== appRoot && !filePath.startsWith(appRoot + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  let size;
  try {
    const st = statSync(filePath);
    if (!st.isFile()) throw new Error('not a file');
    size = st.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Leonida Completionist app/ being served on port ${port}`);
});
