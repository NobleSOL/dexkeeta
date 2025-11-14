#!/usr/bin/env node
/**
 * Verify new OPS seed derivation
 */

import * as KeetaNet from '@keetanetwork/keetanet-client';

function seedFromHex(hex) {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

const opsSeed = '73e2ceb5173cab59f072cd2a57abcc7cbed79d15b4c2fcc3d09a8a24dba47f60';
const expectedAddress = 'keeta_aab76645t72qwcos7j5bhgmsjyii3rufdezkz566irlqq3aphhblelrd722wz7a';

console.log('Verifying new OPS seed...\n');

const seed = seedFromHex(opsSeed);
const account = KeetaNet.lib.Account.fromSeed(seed, 0);
const derivedAddress = account.publicKeyString.get();

console.log(`Expected: ${expectedAddress}`);
console.log(`Derived:  ${derivedAddress}`);
console.log();

if (derivedAddress === expectedAddress) {
  console.log('✅ ADDRESS MATCH - Seed is correct!\n');
} else {
  console.log('❌ ADDRESS MISMATCH - Seed is incorrect!\n');
  process.exit(1);
}
