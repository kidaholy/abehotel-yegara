// Passenger entry point for cPanel/Yegara hosting
const fs = require('fs');
const path = require('path');

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

console.log('Starting AbeHotel standalone server...');

const standaloneModules = path.join(cwd, 'standalone_modules');
const nodeModules = path.join(cwd, 'node_modules');

// 💡 ROBUST MODULE LOADING (cPanel Fix)
// 1. Create a symlink from node_modules -> standalone_modules if it doesn't exist
// This is the most reliable way to satisfy require('next') on restricted hosts.
if (fs.existsSync(standaloneModules) && !fs.existsSync(nodeModules)) {
  try {
    console.log('[abehotel] Creating node_modules -> standalone_modules symlink...');
    fs.symlinkSync('standalone_modules', nodeModules, 'dir');
  } catch (err) {
    console.error('[abehotel] FAILED to create symlink:', err.message);
  }
}

// 2. Inject standalone_modules into NODE_PATH as a fallback
if (fs.existsSync(standaloneModules)) {
  process.env.NODE_PATH = standaloneModules + (process.env.NODE_PATH ? ':' + process.env.NODE_PATH : '');
  require('module').Module._initPaths();
  console.log('[abehotel] Injected standalone_modules into NODE_PATH');
}

// 3. Final check: can we actually see next?
try {
  const nextPath = require.resolve('next');
  console.log('[abehotel] Next.js found at:', nextPath);
} catch (err) {
  console.warn('[abehotel] WARNING: "next" module still not found by require.resolve!');
}

require('./server.js');

