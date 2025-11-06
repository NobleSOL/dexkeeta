// Find correct derivation index for OPS account
import { KeetaNet } from './server/keeta-impl/utils/client.js';

const opsSeedHex = process.env.OPS_SEED;
if (!opsSeedHex) {
  console.error('OPS_SEED not set!');
  process.exit(1);
}

const opsSeed = Buffer.from(opsSeedHex.trim(), 'hex');
const expectedAddress = 'keeta_aabzi2udkrjsc4kcw7ew3wzsbneu2q4bh7ubcj5gbx523k6sklvj2pl4ldlrmpy';

console.log('Searching for OPS derivation index...\n');
console.log(`Expected: ${expectedAddress}\n`);

for (let i = 0; i < 10; i++) {
  const account = KeetaNet.lib.Account.fromSeed(opsSeed, i);
  const address = account.publicKeyString.get();
  const match = address === expectedAddress;

  console.log(`Index ${i}: ${address} ${match ? '✅ MATCH!' : ''}`);

  if (match) {
    console.log(`\n🎉 Found correct index: ${i}`);
    break;
  }
}
