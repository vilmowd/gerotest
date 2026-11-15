/**
 * Production static server for Railway (and similar hosts).
 * Serves Astro's `dist/` on process.env.PORT and applies security headers.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function securityHeaders(filePath) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };

  if (filePath.includes(`${path.sep}_astro${path.sep}`)) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (filePath.endsWith('.html')) {
    headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
  } else {
    headers['Cache-Control'] = 'public, max-age=86400';
  }

  return headers;
}

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  let rel = clean === '/' ? '/index.html' : clean;

  // Block path traversal
  const candidate = path.normalize(path.join(root, rel));
  if (!candidate.startsWith(root)) return null;

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // /about -> /about/index.html  |  /about/ -> /about/index.html
  const asDir = candidate.endsWith(path.sep)
    ? path.join(candidate, 'index.html')
    : path.join(candidate, 'index.html');
  if (fs.existsSync(asDir) && fs.statSync(asDir).isFile()) {
    return asDir;
  }

  // extensionless file.html
  const asHtml = `${candidate}.html`;
  if (fs.existsSync(asHtml) && fs.statSync(asHtml).isFile()) {
    return asHtml;
  }

  return null;
}

const server = http.createServer((req, res) => {
  const filePath = resolveFile(req.url || '/');

  if (!filePath) {
    const notFound = path.join(root, '404.html');
    if (fs.existsSync(notFound)) {
      const body = fs.readFileSync(notFound);
      res.writeHead(404, {
        'Content-Type': 'text/html; charset=utf-8',
        ...securityHeaders(notFound),
      });
      res.end(body);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': type,
    ...securityHeaders(filePath),
  });
  res.end(body);
});

if (!fs.existsSync(root)) {
  console.error(`Missing dist/ at ${root}. Run "npm run build" first.`);
  process.exit(1);
}

server.listen(port, host, () => {
  console.log(`Geroforge serving ${root} on http://${host}:${port}`);
});
