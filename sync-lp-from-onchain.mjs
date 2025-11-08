#!/usr/bin/env node

/**
 * Sync LP positions from on-chain STORAGE account metadata to local file
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

// Get pool reserves
async function getPoolReserves(client, poolAddress) {
  try {
    const poolAccount = KeetaNet.lib.Account.fromPublicKeyString(poolAddress);
    const balances = await client.allBalances({ account: poolAccount });

    if (balances.length < 2) {
      return null;
    }

    return {
      tokenA: balances[0].token?.publicKeyString?.get?.() || balances[0].token.toString(),
      tokenB: balances[1].token?.publicKeyString?.get?.() || balances[1].token.toString(),
      reserveA: BigInt(balances[0].balance || 0n),
      reserveB: BigInt(balances[1].balance || 0n),
    };
  } catch (err) {
    console.error(`Error getting pool reserves:`, err.message);
    return null;
  }
}

// Find LP STORAGE accounts for a pool
async function findLPStorageAccounts(userAddress, poolAddress) {
  // For now, we'll check if there's a specific LP STORAGE account
  // In the future, this could scan the blockchain

  // The LP STORAGE account address would have been stored somewhere
  // For this migration, we need to find it manually or check known patterns

  // Let's check if there's a file with the LP STORAGE address
  try {
    const positionsPath = join(__dirname, `.liquidity-positions-${poolAddress.slice(-8)}.json`);
    const data = await fs.readFile(positionsPath, 'utf8');
    const positions = JSON.parse(data);

    // Check if user has a position with LP storage address
    const userPosition = positions.positions?.[userAddress];
    if (userPosition?.lpStorageAddress) {
      return [userPosition.lpStorageAddress];
    }
  } catch (err) {
    // File doesn't exist or error reading
  }

  return [];
}

// Main function
async function main() {
  console.log('🔄 Syncing LP Positions from On-Chain\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { client, account } = getOpsClient();
  const opsAddress = account.publicKeyString.get();

  console.log(`📡 Connected to Keeta ${NETWORK} network`);
  console.log(`👤 Ops account: ${opsAddress}\n`);

  // Get your user address
  const userSeed = seedFromHexEnv('USER_SEED');
  const userAccount = KeetaNet.lib.Account.fromSeed(userSeed, 0);
  const userAddress = userAccount.publicKeyString.get();

  console.log(`👤 User address: ${userAddress}\n`);
  console.log(`📍 Pool: ${POOL_ADDRESS}\n`);

  // Get pool reserves
  console.log('📊 Fetching pool reserves...');
  const reserves = await getPoolReserves(client, POOL_ADDRESS);

  if (!reserves) {
    console.error('❌ Could not fetch pool reserves');
    process.exit(1);
  }

  console.log(`   Token A: ${reserves.tokenA}`);
  console.log(`   Token B: ${reserves.tokenB}`);
  console.log(`   Reserve A: ${reserves.reserveA}`);
  console.log(`   Reserve B: ${reserves.reserveB}\n`);

  // Look for LP STORAGE accounts
  console.log('🔍 Looking for LP STORAGE accounts...');
  const lpStorageAddresses = await findLPStorageAccounts(userAddress, POOL_ADDRESS);

  if (lpStorageAddresses.length === 0) {
    console.log('   ⚠️ No LP STORAGE accounts found in local file');
    console.log('   Enter the LP STORAGE account address manually or check the blockchain');
    process.exit(1);
  }

  console.log(`   Found ${lpStorageAddresses.length} LP STORAGE account(s)\n`);

  // Read metadata from each LP STORAGE account
  const positions = {};
  let totalShares = 0n;

  for (const lpStorageAddress of lpStorageAddresses) {
    const lpData = await readLPMetadata(client, lpStorageAddress);

    if (lpData && lpData.shares > 0n) {
      positions[lpData.owner] = {
        lpStorageAddress: lpData.lpStorageAddress,
        shares: lpData.shares.toString(),
      };
      totalShares += lpData.shares;
      console.log(`   ✅ Found position for ${lpData.owner.slice(0, 20)}... with ${lpData.shares} shares\n`);
    }
  }

  // Save to local file
  const filePath = `.liquidity-positions-${POOL_ADDRESS.slice(-8)}.json`;
  const fileData = {
    poolAddress: POOL_ADDRESS,
    totalShares: totalShares.toString(),
    positions,
  };

  await fs.writeFile(filePath, JSON.stringify(fileData, null, 2));

  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`✅ Synced LP positions to ${filePath}`);
  console.log(`   Total shares: ${totalShares}`);
  console.log(`   Positions: ${Object.keys(positions).length}\n`);
}

main().catch(console.error);
