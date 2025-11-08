#!/usr/bin/env node

/**
 * Check new LP account info
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const NETWORK = 'test';
const NEW_LP_ADDRESS = 'keeta_aqrlkfejut3zpq6ghbajdqs4ndkry42hwi2dpp2mxecvdnplvigdw54xgn7ss';

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
  console.log('🔍 Checking NEW LP STORAGE Account Info (Properly Labeled)\n');

  const { client } = getOpsClient();

  const accountsInfo = await client.client.getAccountsInfo([NEW_LP_ADDRESS]);
  const info = accountsInfo[NEW_LP_ADDRESS];

  console.log('Account:', NEW_LP_ADDRESS);
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
