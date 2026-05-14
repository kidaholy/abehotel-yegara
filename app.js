// Passenger entry point for cPanel/Yegara hosting
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '3000';

// Passenger can launch Node with a different cwd than the app root.
// Next standalone resolves static assets from process.cwd(), so force it.
process.chdir(__dirname);
const cwd = __dirname;
const need = ['server.js', 'package.json', 'data', '.next'];
const present = Object.fromEntries(
  need.map((n) => [n, fs.existsSync(path.join(cwd, n))])
);
console.log('[abehotel] cwd=', cwd);
console.log('[abehotel] paths=', JSON.stringify(present));
console.log('[abehotel] NODE_ENV=', process.env.NODE_ENV, 'PORT=', process.env.PORT);

// 💡 Force-sync fresh static assets from next_assets to .next/static on every boot.
// This is critical because cPanel ignores .next in Git, so stale hashes persist
// until manually overwritten.
try {
  const nextDir = path.join(cwd, '.next');
  const nextAssetsDir = path.join(cwd, 'next_assets');

  if (fs.existsSync(nextAssetsDir)) {
    console.log('[abehotel] Syncing fresh build artifacts from next_assets to .next...');
    if (fs.existsSync(nextDir)) {
      fs.rmSync(nextDir, { recursive: true, force: true });
    }
    fs.cpSync(nextAssetsDir, nextDir, { recursive: true });
    console.log('[abehotel] Synced .next successfully');
  }
} catch (err) {
  console.error('[abehotel] FAILED syncing .next:', err.message);
}

console.log('Starting AbeHotel standalone server...');

const standaloneModules = path.join(cwd, 'standalone_modules');
if (fs.existsSync(standaloneModules)) {
  process.env.NODE_PATH = standaloneModules + (process.env.NODE_PATH ? ':' + process.env.NODE_PATH : '');
  require('module').Module._initPaths();
  console.log('[abehotel] Injected standalone_modules into NODE_PATH');
}

require('./server.js');
