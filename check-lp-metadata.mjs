#!/usr/bin/env node

/**
 * Check LP STORAGE account metadata (on-chain shares)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const NETWORK = 'test';
const LP_STORAGE_ADDRESS = 'keeta_aqrlkfejut3zpq6ghbajdqs4ndkry42hwi2dpp2mxecvdnplvigdw54xgn7ss';

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
  console.log('🔍 Checking LP STORAGE Account On-Chain Metadata\n');

  const { client } = getOpsClient();

  // Get account info
  const accountsInfo = await client.client.getAccountsInfo([LP_STORAGE_ADDRESS]);
  const info = accountsInfo[LP_STORAGE_ADDRESS];

  console.log('LP STORAGE Address:', LP_STORAGE_ADDRESS);
  console.log('\n📝 Account Info:');
  console.log('  Name:', info?.info?.name || '(none)');
  console.log('  Description:', info?.info?.description || '(none)');

  if (info?.info?.metadata) {
    console.log('\n✅ Metadata Found (On-Chain):');
    try {
      const metadataJson = Buffer.from(info.info.metadata, 'base64').toString('utf8');
      const metadata = JSON.parse(metadataJson);
      console.log(JSON.stringify(metadata, null, 2));

      if (metadata.shares) {
        console.log('\n🎯 LP Shares (On-Chain):', metadata.shares);
        console.log('  This IS visible on the explorer!');
      } else {
        console.log('\n⚠️ Metadata exists but no "shares" field found');
      }
    } catch (err) {
      console.error('  ❌ Error parsing metadata:', err.message);
    }
  } else {
    console.log('\n❌ No Metadata Found');
    console.log('  LP shares are NOT stored on-chain!');
    console.log('  Users cannot verify ownership on the explorer.');
  }

  // Check balances
  console.log('\n💰 Token Balances:');
  const lpAccount = KeetaNet.lib.Account.fromPublicKeyString(LP_STORAGE_ADDRESS);
  const balances = await client.allBalances({ account: lpAccount });

  if (balances.length === 0) {
    console.log('  (none)');
  } else {
    for (const bal of balances) {
      const token = bal.token.publicKeyString?.toString() ?? bal.token.toString();
      console.log(`  ${token}: ${bal.balance}`);
    }
  }
}

main().catch(console.error);
