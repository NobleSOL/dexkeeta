#!/usr/bin/env node

/**
 * Simple script to sync a specific LP position from on-chain to local file
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const NETWORK = 'test';
const POOL_ADDRESS = 'keeta_atzfyx6ocqbxup5djw75nikn5nvafhsj3kkl7g7ohlm6hbgzspxip4bahp34u';
const LP_STORAGE_ADDRESS = 'keeta_atye23zpb3j4vvil63b2frp25gm3gw4zdzwcrh7oeqz67k3aigycsuuyjpzz2';

// Helper to create seed from hex
function seedFromHexEnv(envVar) {
  const seedHex = process.env[envVar];
  if (!seedHex) {
    throw new Error(`Missing ${envVar} in .env`);
  }
  return Buffer.from(seedHex.trim(), 'hex');
}

// Create ops client
function getOpsClient() {
  const opsSeed = seedFromHexEnv('OPS_SEED');
  const opsAccount = KeetaNet.lib.Account.fromSeed(opsSeed, 0);
  const client = KeetaNet.UserClient.fromNetwork(NETWORK, opsAccount);
  return { client, account: opsAccount };
}

// Read LP metadata from STORAGE account
async function readLPMetadata(client, lpStorageAddress) {
  try {
    console.log(`🔍 Reading LP metadata from: ${lpStorageAddress}`);

    const accountsInfo = await client.client.getAccountsInfo([lpStorageAddress]);
    const info = accountsInfo[lpStorageAddress];

    if (!info?.info?.metadata) {
      console.log('   ⚠️ No metadata found on this account');
      return null;
    }

    // Decode base64 metadata
    const metadataJson = Buffer.from(info.info.metadata, 'base64').toString('utf8');
    const metadata = JSON.parse(metadataJson);

    console.log('   ✅ On-chain LP metadata found:');
    console.log(`      Pool: ${metadata.pool}`);
    console.log(`      Owner: ${metadata.owner}`);
    console.log(`      Shares: ${metadata.shares}`);

    return {
      shares: BigInt(metadata.shares),
      pool: metadata.pool,
      owner: metadata.owner,
      lpStorageAddress: lpStorageAddress,
    };
  } catch (err) {
    console.error(`   ❌ Error reading LP metadata:`, err.message);
    return null;
  }
}

// Main function
async function main() {
  console.log('🔄 Syncing LP Position from On-Chain\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { client } = getOpsClient();

  console.log(`📡 Connected to Keeta ${NETWORK} network\n`);
  console.log(`📍 Pool: ${POOL_ADDRESS}`);
  console.log(`📍 LP STORAGE: ${LP_STORAGE_ADDRESS}\n`);

  // Read metadata from LP STORAGE account
  const lpData = await readLPMetadata(client, LP_STORAGE_ADDRESS);

  if (!lpData || lpData.shares === 0n) {
    console.error('❌ No LP position found on-chain or shares are 0');
    process.exit(1);
  }

  console.log(`\n✅ Found position for ${lpData.owner} with ${lpData.shares} shares\n`);

  // Save to local file
  const filePath = `.liquidity-positions-${POOL_ADDRESS.slice(-8)}.json`;
  const fileData = {
    poolAddress: POOL_ADDRESS,
    totalShares: lpData.shares.toString(),
    positions: {
      [lpData.owner]: {
        lpStorageAddress: LP_STORAGE_ADDRESS,
        shares: lpData.shares.toString(),
      }
    },
  };

  await fs.writeFile(filePath, JSON.stringify(fileData, null, 2));

  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`✅ Synced LP position to ${filePath}`);
  console.log(`   Total shares: ${lpData.shares}`);
  console.log(`   Owner: ${lpData.owner}\n`);
}

main().catch(console.error);
