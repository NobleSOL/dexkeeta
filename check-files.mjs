import { readdirSync, existsSync } from 'fs';

console.log('=== File Check ===');
console.log('Current directory:', process.cwd());
console.log('\nFiles in current directory:');
console.log(readdirSync('.'));

console.log('\nDoes server directory exist?', existsSync('./server'));
if (existsSync('./server')) {
  console.log('Files in server directory:');
  console.log(readdirSync('./server'));
}

console.log('\nDoes server/node-build.ts exist?', existsSync('./server/node-build.ts'));
