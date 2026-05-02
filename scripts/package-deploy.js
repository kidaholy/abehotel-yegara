const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

async function packageDeploy() {
  const rootDir = process.cwd();
  const deployDir = path.join(rootDir, 'deploy');
  const standaloneDir = path.join(rootDir, '.next', 'standalone');

  console.log('--- Starting JSON-Based Deployment Packaging ---');

  // 1. Build the project
  console.log('Building Next.js project...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('Build failed!', error);
    process.exit(1);
  }

  // 2. Prepare deploy directory
  console.log('Preparing deploy directory...');
  if (fs.existsSync(deployDir)) {
    fs.removeSync(deployDir);
  }
  fs.ensureDirSync(deployDir);

  // 3. Copy standalone output
  if (!fs.existsSync(standaloneDir)) {
    console.error('Standalone directory not found! Ensure "output: standalone" is in next.config.mjs');
    process.exit(1);
  }
  console.log('Copying standalone files...');
  fs.copySync(standaloneDir, deployDir);

  // 4. Copy Data Folder (The new JSON Database)
  console.log('Copying local data files...');
  const dataDir = path.join(rootDir, 'data');
  if (fs.existsSync(dataDir)) {
    fs.copySync(dataDir, path.join(deployDir, 'data'));
  } else {
    console.log('Warning: data folder not found. Creating empty data folder.');
    fs.ensureDirSync(path.join(deployDir, 'data'));
  }

  // 5. Copy static and public assets
  console.log('Copying static and public assets...');
  const nextStaticDir = path.join(rootDir, '.next', 'static');
  const publicDir = path.join(rootDir, 'public');

  if (fs.existsSync(nextStaticDir)) {
    fs.copySync(nextStaticDir, path.join(deployDir, '.next', 'static'));
  }
  if (fs.existsSync(publicDir)) {
    fs.copySync(publicDir, path.join(deployDir, 'public'));
  }

  // 6. Create app.js bridge with logging
  console.log('Creating app.js bridge...');
  const appJsContent = `
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'debug.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(msg, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const formattedMsg = '[' + timestamp + '] [' + type + '] ' + msg + '\\n';
    logStream.write(formattedMsg);
    if (type === 'ERROR') {
        process.stderr.write(formattedMsg);
    } else {
        process.stdout.write(formattedMsg);
    }
}

console.log = (msg) => log(msg, 'LOG');
console.error = (msg) => log(msg, 'ERROR');

process.on('uncaughtException', (err) => {
    log('UNCAUGHT EXCEPTION: ' + (err.stack || err), 'ERROR');
});

process.on('unhandledRejection', (reason) => {
    log('UNHANDLED REJECTION: ' + (reason.stack || reason), 'ERROR');
});

process.env.PORT = process.env.PORT || 3000;
process.env.NODE_ENV = 'production';
process.env.HOSTNAME = '127.0.0.1';

log('--- Starting JSON-Based Next.js server ---');

try {
    if (fs.existsSync(path.join(__dirname, 'server.js'))) {
        require('./server.js');
        log('server.js required successfully');
    } else {
        log('CRITICAL ERROR: server.js not found in current directory!', 'ERROR');
    }
} catch (err) {
    log('FAILED TO LOAD server.js: ' + err.stack, 'ERROR');
}
`;
  fs.writeFileSync(path.join(deployDir, 'app.js'), appJsContent);

  // 7. Copy .env for reference
  const envFile = path.join(rootDir, '.env');
  if (fs.existsSync(envFile)) {
    fs.copySync(envFile, path.join(deployDir, '.env.example'));
  }

  console.log('--- Packaging Complete! ---');
  console.log('Contents ready in: ' + deployDir);
  console.log('Next Steps: ZIP the contents of "deploy" folder and upload to cPanel.');
}

try {
    require('fs-extra');
    packageDeploy();
} catch (e) {
    console.log('fs-extra not found, installing...');
    execSync('npm install fs-extra --no-save');
    packageDeploy();
}
