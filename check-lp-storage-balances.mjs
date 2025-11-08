#!/usr/bin/env node

/**
 * Check token balances for LP STORAGE account
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const NETWORK = 'test';
const LP_STORAGE_ADDRESS = 'keeta_aq4j564wpz4zsyiis3ngfl2esu23q7fpopp6mtzlpm7lglfl7h5ahh46leyik';
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
  console.log('🔍 Checking Token Balances\n');

  const { client } = getOpsClient();

  console.log('LP STORAGE Account:', LP_STORAGE_ADDRESS);
  console.log('Pool Account:', POOL_ADDRESS);
  console.log('');

  // Check LP STORAGE balances
  console.log('📊 LP STORAGE Balances:');
  const lpAccount = KeetaNet.lib.Account.fromPublicKeyString(LP_STORAGE_ADDRESS);
  const lpBalances = await client.allBalances({ account: lpAccount });

  if (lpBalances.length === 0) {
    console.log('  (none)');
  } else {
    for (const bal of lpBalances) {
      const token = bal.token.publicKeyString?.toString() ?? bal.token.toString();
      console.log(`  ${token}: ${bal.balance}`);
    }
  }

  console.log('');

  // Check Pool balances
  console.log('📊 Pool Account Balances:');
  const poolAccount = KeetaNet.lib.Account.fromPublicKeyString(POOL_ADDRESS);
  const poolBalances = await client.allBalances({ account: poolAccount });

  if (poolBalances.length === 0) {
    console.log('  (none)');
  } else {
    for (const bal of poolBalances) {
      const token = bal.token.publicKeyString?.toString() ?? bal.token.toString();
      console.log(`  ${token}: ${bal.balance}`);
    }
  }
}

main().catch(console.error);
