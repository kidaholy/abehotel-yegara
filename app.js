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

console.log('Starting AbeHotel standalone server...');

const standaloneModules = path.join(cwd, 'standalone_modules');
const nodeModules = path.join(cwd, 'node_modules');
const nextDir = path.join(cwd, '.next');
const nextAssetsDir = path.join(cwd, 'next_assets');

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

// 2b. If node_modules exists but is partial, force-link critical packages.
// This avoids "Cannot find module 'next'" when cPanel leaves an incomplete node_modules.
try {
  const criticalPackages = ['next', 'react', 'react-dom'];
  if (fs.existsSync(standaloneModules)) {
    fs.mkdirSync(nodeModules, { recursive: true });
    for (const pkg of criticalPackages) {
      const target = path.join(standaloneModules, pkg);
      const link = path.join(nodeModules, pkg);
      if (fs.existsSync(target) && !fs.existsSync(link)) {
        fs.symlinkSync(target, link, 'junction');
        console.log(`[abehotel] Linked node_modules/${pkg} -> standalone_modules/${pkg}`);
      }
    }
  }
} catch (err) {
  console.error('[abehotel] FAILED linking critical modules:', err.message);
}

// 2b. If node_modules exists but is partial, force-link critical packages.
// This avoids "Cannot find module 'next'" when cPanel leaves an incomplete node_modules.
try {
  const criticalPackages = ['next', 'react', 'react-dom'];
  if (fs.existsSync(standaloneModules)) {
    fs.mkdirSync(nodeModules, { recursive: true });
    for (const pkg of criticalPackages) {
      const target = path.join(standaloneModules, pkg);
      const link = path.join(nodeModules, pkg);
      if (fs.existsSync(target) && !fs.existsSync(link)) {
        fs.symlinkSync(target, link, 'junction');
        console.log(`[abehotel] Linked node_modules/${pkg} -> standalone_modules/${pkg}`);
      }
    }
  }
} catch (err) {
  console.error('[abehotel] FAILED linking critical modules:', err.message);
}

// 3. Final check: can we actually see next?
try {
  const nextPath = require.resolve('next');
  console.log('[abehotel] Next.js found at:', nextPath);
} catch (err) {
  console.warn('[abehotel] WARNING: "next" module still not found by require.resolve!');
}

// 4. cPanel-safe fallback for static assets.
// Some deploy pipelines or hosts can drop dot-prefixed folders.
// If ".next/static" is missing but "next_assets/static" exists, recreate it before boot.
try {
  const hasNextStatic = fs.existsSync(path.join(nextDir, 'static'));
  const hasFallbackStatic = fs.existsSync(path.join(nextAssetsDir, 'static'));

  if (!hasNextStatic && hasFallbackStatic) {
    console.log('[abehotel] Restoring .next/static from next_assets/static...');
    fs.mkdirSync(nextDir, { recursive: true });
    fs.cpSync(path.join(nextAssetsDir, 'static'), path.join(nextDir, 'static'), { recursive: true });
    console.log('[abehotel] Restored .next/static successfully');
  }
} catch (err) {
  console.error('[abehotel] FAILED restoring .next/static:', err.message);
}

// 5. Legacy layout repair:
// If host/deploy produced ".next/chunks" and ".next/media" directly at root,
// mirror them into ".next/static/*" where Next expects them.
try {
  const nextStaticDir = path.join(nextDir, 'static');
  const legacyChunksDir = path.join(nextDir, 'chunks');
  const legacyMediaDir = path.join(nextDir, 'media');
  const legacyChunkFilesDir = path.join(nextDir, 'chunk-files');

  const hasLegacyLayout =
    fs.existsSync(legacyChunksDir) ||
    fs.existsSync(legacyMediaDir) ||
    fs.existsSync(legacyChunkFilesDir);

  if (hasLegacyLayout) {
    fs.mkdirSync(nextStaticDir, { recursive: true });

    if (fs.existsSync(legacyChunksDir) && !fs.existsSync(path.join(nextStaticDir, 'chunks'))) {
      fs.cpSync(legacyChunksDir, path.join(nextStaticDir, 'chunks'), { recursive: true });
      console.log('[abehotel] Mirrored legacy .next/chunks -> .next/static/chunks');
    }

    if (fs.existsSync(legacyMediaDir) && !fs.existsSync(path.join(nextStaticDir, 'media'))) {
      fs.cpSync(legacyMediaDir, path.join(nextStaticDir, 'media'), { recursive: true });
      console.log('[abehotel] Mirrored legacy .next/media -> .next/static/media');
    }

    if (fs.existsSync(legacyChunkFilesDir) && !fs.existsSync(path.join(nextStaticDir, 'chunk-files'))) {
      fs.cpSync(legacyChunkFilesDir, path.join(nextStaticDir, 'chunk-files'), { recursive: true });
      console.log('[abehotel] Mirrored legacy .next/chunk-files -> .next/static/chunk-files');
    }
  }
} catch (err) {
  console.error('[abehotel] FAILED legacy static layout repair:', err.message);
}

require('./server.js');

