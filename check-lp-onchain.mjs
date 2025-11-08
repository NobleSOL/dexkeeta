#!/usr/bin/env node

/**
 * Check on-chain LP positions stored in STORAGE account metadata
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const NETWORK = 'test';

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
    console.log(`\n🔍 Reading LP metadata from: ${lpStorageAddress}`);

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
    console.log(`      Updated: ${new Date(metadata.updatedAt).toLocaleString()}`);

    // Also show account info
    if (info.info.name) {
      console.log(`\n   📋 Account Info:`);
      console.log(`      Name: ${info.info.name}`);
      console.log(`      Description: ${info.info.description || 'N/A'}`);
    }

    return {
      shares: BigInt(metadata.shares),
      pool: metadata.pool,
      owner: metadata.owner,
      updatedAt: metadata.updatedAt
    };
  } catch (err) {
    console.error(`   ❌ Error reading LP metadata:`, err.message);
    return null;
  }
}

// Load liquidity positions from local file
async function loadLiquidityPositions(poolAddress) {
  try {
    const fs = await import('fs/promises');
    const positionsPath = join(__dirname, '.liquidity-positions.json');
    const data = await fs.readFile(positionsPath, 'utf8');
    const allPositions = JSON.parse(data);

    // Return positions for specific pool
    return allPositions[poolAddress] || {};
  } catch (err) {
    return {};
  }
}

// Main function
async function main() {
  console.log('🔎 Checking On-Chain LP Positions\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { client, account } = getOpsClient();
  const opsAddress = account.publicKeyString.get();

  console.log(`📡 Connected to Keeta ${NETWORK} network`);
  console.log(`👤 Ops account: ${opsAddress}\n`);

  // Load pools
  const fs = await import('fs/promises');
  const poolsPath = join(__dirname, '.pools.json');
  let poolsData;
  try {
    poolsData = JSON.parse(await fs.readFile(poolsPath, 'utf8'));
  } catch (err) {
    console.error('❌ Could not load .pools.json');
    process.exit(1);
  }

  const pools = Object.values(poolsData);
  console.log(`📊 Found ${pools.length} pools\n`);

  // Check each pool for LP positions
  for (const pool of pools) {
    console.log(`\n${'═'.repeat(63)}`);
    console.log(`📍 Pool: ${pool.address.slice(-20)}...`);
    console.log(`   TokenA: ${pool.tokenA.slice(-20)}...`);
    console.log(`   TokenB: ${pool.tokenB.slice(-20)}...`);

    // Load local LP positions for this pool
    const positions = await loadLiquidityPositions(pool.address);
    const userAddresses = Object.keys(positions);

    if (userAddresses.length === 0) {
      console.log('\n   ℹ️ No LP positions for this pool');
      continue;
    }

    console.log(`\n   👥 Found ${userAddresses.length} LP position(s):\n`);

    // Check each LP position
    for (const userAddress of userAddresses) {
      const position = positions[userAddress];

      console.log(`   👤 User: ${userAddress.slice(0, 20)}...${userAddress.slice(-8)}`);
      console.log(`      Local shares: ${position.shares}`);
      console.log(`      LP Storage Address: ${position.lpStorageAddress || 'Not created yet'}`);

      if (position.lpStorageAddress) {
        // Read on-chain metadata
        const onchainData = await readLPMetadata(client, position.lpStorageAddress);

        if (onchainData) {
          // Verify matches
          if (onchainData.shares.toString() === position.shares.toString()) {
            console.log(`      ✅ On-chain matches local storage!`);
          } else {
            console.log(`      ⚠️ MISMATCH: On-chain has ${onchainData.shares}, local has ${position.shares}`);
          }

          // Show explorer link
          console.log(`\n      🔗 View on Explorer:`);
          console.log(`         https://explorer.test.keeta.com/account/${position.lpStorageAddress}`);
        }
      } else {
        console.log(`      ⚠️ LP STORAGE account not yet created (old position)`);
      }

      console.log(''); // blank line
    }
  }

  console.log(`\n${'═'.repeat(63)}\n`);
  console.log('✅ Check complete!\n');
  console.log('💡 How to verify on-chain:');
  console.log('   1. Copy an LP Storage Address from above');
  console.log('   2. Visit: https://explorer.test.keeta.com/account/{address}');
  console.log('   3. Look for the "Metadata" field - it contains the LP shares in JSON format\n');
}

main().catch(console.error);
