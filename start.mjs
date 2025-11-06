import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';

console.log('=== Pre-flight Check ===');
console.log('Current directory:', process.cwd());
console.log('\nFiles in root:');
try {
  console.log(readdirSync('.').join(', '));
} catch (err) {
  console.error('Error reading root:', err.message);
}

console.log('\nChecking for server directory...');

// Check multiple possible locations
let serverPath = null;
if (existsSync('./server')) {
  console.log('✅ server/ directory exists in root');
  serverPath = './server/node-build.ts';
} else if (existsSync('./dist/server-built/server')) {
  console.log('✅ server/ directory exists in dist/server-built/');
  serverPath = './dist/server-built/server/node-build.ts';
} else {
  console.error('❌ server/ directory NOT FOUND in any location');
  console.log('\nChecking dist directory...');
  if (existsSync('./dist')) {
    console.log('Files in dist/:', readdirSync('./dist').join(', '));
  }
  console.log('\nThis means Railway did not deploy the server files.');
  console.log('Please check Railway project settings:');
  console.log('1. Verify repository is NobleSOL/dexkeeta');
  console.log('2. Verify branch is main');
  console.log('3. Check for any "Root Directory" or "Watch Paths" settings');
  process.exit(1);
}

if (existsSync(serverPath)) {
  console.log(`✅ ${serverPath} exists`);
  console.log('\n=== Starting server with tsx ===');

  // Start the server
  const proc = spawn('npx', ['tsx', serverPath], {
    stdio: 'inherit',
    shell: true
  });

  proc.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  proc.on('exit', (code) => {
    console.log('Server process exited with code:', code);
    process.exit(code);
  });
} else {
  console.error(`❌ ${serverPath} NOT FOUND`);
  process.exit(1);
}
