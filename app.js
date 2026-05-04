// Passenger entry point for cPanel/Yegara hosting
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '3000';

const cwd = process.cwd();
const need = ['server.js', 'package.json', 'data', '.next'];
const present = Object.fromEntries(
  need.map((n) => [n, fs.existsSync(path.join(cwd, n))])
);
console.log('[abehotel] cwd=', cwd);
console.log('[abehotel] paths=', JSON.stringify(present));
console.log('[abehotel] NODE_ENV=', process.env.NODE_ENV, 'PORT=', process.env.PORT);

const standaloneModules = path.join(cwd, 'standalone_modules');
if (fs.existsSync(standaloneModules)) {
  process.env.NODE_PATH = standaloneModules + (process.env.NODE_PATH ? ':' + process.env.NODE_PATH : '');
  require('module').Module._initPaths();
  console.log('[abehotel] Injected standalone_modules into NODE_PATH');
}

// --- Static file MIME types ---
const MIME_TYPES = {
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
};

// Static dirs to serve directly (URL prefix -> filesystem path relative to cwd)
const STATIC_ROUTES = [
  { prefix: '/_next/static/', dir: path.join(cwd, '.next', 'static') },
  { prefix: '/public/',       dir: path.join(cwd, 'public') },
];

// Also serve top-level public files at root (e.g. /icon.svg, /favicon.ico)
const PUBLIC_DIR = path.join(cwd, 'public');

/**
 * Try to serve a static file. Returns true if handled, false otherwise.
 */
function tryServeStatic(req, res) {
  const parsedUrl = url.parse(req.url);
  const reqPath = parsedUrl.pathname || '/';

  // Check named static route prefixes first
  for (const route of STATIC_ROUTES) {
    if (reqPath.startsWith(route.prefix)) {
      const filePart = reqPath.slice(route.prefix.length);
      const filePath = path.join(route.dir, filePart);
      // Safety: ensure we stay within the intended directory
      if (!filePath.startsWith(route.dir)) return false;
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': content.length,
        });
        res.end(content);
        return true;
      }
      // File not found in static dir → let Next.js handle (will 404 gracefully)
      return false;
    }
  }

  // Serve top-level public files at root (e.g. /icon.svg, /menu-items-variety.jpg)
  if (reqPath !== '/' && !reqPath.startsWith('/_next') && !reqPath.startsWith('/api')) {
    // Only single-segment paths (no subdirs) or known extensions
    const ext = path.extname(reqPath).toLowerCase();
    if (ext && MIME_TYPES[ext]) {
      const filePath = path.join(PUBLIC_DIR, reqPath);
      if (!filePath.startsWith(PUBLIC_DIR)) return false;
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const mime = MIME_TYPES[ext];
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400',
          'Content-Length': content.length,
        });
        res.end(content);
        return true;
      }
    }
  }

  return false;
}

// Monkey-patch http.createServer so our static handler runs before Next.js
const _createServer = http.createServer.bind(http);
http.createServer = function (opts, handler) {
  // Next.js calls createServer with just a handler (no opts) in some versions
  if (typeof opts === 'function') {
    handler = opts;
    opts = undefined;
  }
  const wrapped = function (req, res) {
    if (tryServeStatic(req, res)) return;
    handler(req, res);
  };
  return opts ? _createServer(opts, wrapped) : _createServer(wrapped);
};

console.log('[abehotel] Static file middleware patched');
console.log('Starting AbeHotel standalone server...');

require('./server.js');
