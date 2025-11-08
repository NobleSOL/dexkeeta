#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const NETWORK = 'test';
const LP_STORAGE_ADDRESS = 'keeta_aq4j564wpz4zsyiis3ngfl2esu23q7fpopp6mtzlpm7lglfl7h5ahh46leyik';

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
  console.log('🔍 Checking LP STORAGE Account Info\n');

  const { client } = getOpsClient();

  const accountsInfo = await client.client.getAccountsInfo([LP_STORAGE_ADDRESS]);
  const info = accountsInfo[LP_STORAGE_ADDRESS];

  console.log('Account:', LP_STORAGE_ADDRESS);
  console.log('\nName:', info?.info?.name || '(none)');
  console.log('Description:', info?.info?.description || '(none)');

  if (info?.info?.metadata) {
    const metadataJson = Buffer.from(info.info.metadata, 'base64').toString('utf8');
    const metadata = JSON.parse(metadataJson);
    console.log('\nMetadata:');
    console.log(JSON.stringify(metadata, null, 2));
  } else {
    console.log('\nMetadata: (none)');
  }
}

main().catch(console.error);
