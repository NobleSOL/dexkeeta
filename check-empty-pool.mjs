#!/usr/bin/env node

/**
 * Check the empty pool that's causing add liquidity errors
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const NETWORK = 'test';
const POOL_ADDRESS = 'keeta_atulpbgzwrphasyensi234jrpnyefv4fqoaovrjrex4cjw6rbiibq6panevsg';

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
  console.log('🔍 Checking Empty Pool That Errors on Add Liquidity\n');

  const { client } = getOpsClient();

  const poolAccount = KeetaNet.lib.Account.fromPublicKeyString(POOL_ADDRESS);
  const poolBalances = await client.allBalances({ account: poolAccount });

  console.log('Pool:', POOL_ADDRESS);
  console.log('Pool Suffix:', POOL_ADDRESS.slice(-8));
  console.log('\n📊 Balances:');

  if (poolBalances.length === 0) {
    console.log('  ✅ CONFIRMED: Pool is EMPTY (no reserves)');
  } else {
    for (const bal of poolBalances) {
      const token = bal.token.publicKeyString?.toString() ?? bal.token.toString();
      console.log(`  ${token}: ${bal.balance}`);
    }
  }

  // Check if pool exists in .pools.json
  const fs = await import('fs/promises');
  const poolsData = await fs.readFile('.pools.json', 'utf8');
  const pools = JSON.parse(poolsData);

  let poolInfo = null;
  for (const [key, value] of Object.entries(pools)) {
    if (value.address === POOL_ADDRESS) {
      poolInfo = value;
      console.log('\n📝 Pool Info (.pools.json):');
      console.log('  Token A:', value.tokenA);
      console.log('  Token B:', value.tokenB);
      console.log('  Creator:', value.creator);
      break;
    }
  }

  if (!poolInfo) {
    console.log('\n❌ Pool NOT found in .pools.json');
  }

  // Check for LP position file
  const poolSuffix = POOL_ADDRESS.slice(-8);
  const lpFile = `.liquidity-positions-${poolSuffix}.json`;

  try {
    const lpData = await fs.readFile(lpFile, 'utf8');
    console.log(`\n📄 LP Position File (${lpFile}):`, lpData);
  } catch (err) {
    console.log(`\n❌ No LP position file: ${lpFile}`);
  }
}

main().catch(console.error);
