#!/usr/bin/env node

/**
 * Check pool reserves on-chain
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const NETWORK = 'test';
const POOL_ADDRESS = 'keeta_athz5k3zcwdkhvbhkso3ac34uhanucgzhd2gn3tfhuahgzaljslostzej2lvm';

function seedFromHexEnv(envVar) {
  const seedHex = process.env[envVar];
  if (!seedHex) {
    throw new Error(`Missing ${envVar} in .env`);
  }
  return Buffer.from(seedHex.trim(), 'hex');
}

function getOpsClient() {
  const opsSeed = seedFromHexEnv('OPS_SEED');
  const opsAccount = KeetaNet.lib.Account.fromSeed(opsSeed, 0);
  const client = KeetaNet.UserClient.fromNetwork(NETWORK, opsAccount);
  return { client, account: opsAccount };
}

async function main() {
  console.log('🔍 Checking Pool Reserves\n');

  const { client } = getOpsClient();

  const poolAccount = KeetaNet.lib.Account.fromPublicKeyString(POOL_ADDRESS);
  const poolBalances = await client.allBalances({ account: poolAccount });

  console.log('Pool:', POOL_ADDRESS);
  console.log('\n📊 Balances:');

  if (poolBalances.length === 0) {
    console.log('  (none - pool is empty)');
  } else {
    for (const bal of poolBalances) {
      const token = bal.token.publicKeyString?.toString() ?? bal.token.toString();
      console.log(`  ${token}: ${bal.balance}`);
    }
  }
}

main().catch(console.error);
