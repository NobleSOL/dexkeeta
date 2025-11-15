#!/usr/bin/env node
/**
 * Migrate database pools to populate LP token addresses
 *
 * This script:
 * 1. Loads all pools from PostgreSQL database
 * 2. For each pool, reads the LP token address from blockchain
 * 3. Updates the database with the LP token address
 */

import * as KeetaSDK from '@keetanetwork/keetanet-client';
import { PoolRepository } from '../server/keeta-impl/db/pool-repository.js';
import dotenv from 'dotenv';

dotenv.config();

const KEETA_NETWORK = 'test';

async function findLpTokenForPool(client, poolAddress) {
  try {
    // Get account info from blockchain
    const accountsInfo = await client.client.getAccountsInfo([poolAddress]);
    const accountInfo = accountsInfo[poolAddress];

    if (!accountInfo?.info?.name) {
      console.warn(`  ⚠️ No account info for pool ${poolAddress.slice(-8)}`);
      return null;
    }

    // The LP token is stored in the pool's name field
    // Format: "SILVERBACK_POOL|<lpTokenAddress>"
    const parts = accountInfo.info.name.split('|');
    if (parts.length >= 2 && parts[0] === 'SILVERBACK_POOL') {
      return parts[1];
    }

    console.warn(`  ⚠️ Pool name doesn't match expected format: ${accountInfo.info.name}`);
    return null;
  } catch (error) {
    console.error(`  ❌ Error reading pool ${poolAddress.slice(-8)}:`, error.message);
    return null;
  }
}

async function migrateDatabase() {
  console.log('🔧 Migrating database pools to populate LP token addresses...\n');

  try {
    // Create repository and client
    const repository = new PoolRepository();
    const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);

    // Load all pools from database
    console.log('[1/2] Loading pools from database...');
    const pools = await repository.loadPools();
    console.log(`✅ Found ${pools.length} pools in database\n`);

    // Process each pool
    console.log('[2/2] Updating LP token addresses...\n');
    let updated = 0;
    let skipped = 0;

    for (const pool of pools) {
      const shortAddr = pool.pool_address.slice(-8);
      console.log(`📍 Processing pool ${shortAddr}...`);

      // Skip if already has LP token
      if (pool.lp_token_address) {
        console.log(`   ⏭️ Already has LP token: ${pool.lp_token_address.slice(-8)}\n`);
        skipped++;
        continue;
      }

      // Find LP token address from blockchain
      const lpTokenAddress = await findLpTokenForPool(client, pool.pool_address);

      if (lpTokenAddress) {
        // Update database
        await repository.updatePoolLPToken(pool.pool_address, lpTokenAddress);
        console.log(`   ✅ Updated with LP token: ${lpTokenAddress.slice(-8)}\n`);
        updated++;
      } else {
        console.log(`   ⚠️ No LP token found (legacy pool)\n`);
        skipped++;
      }
    }

    console.log('\n✅ Migration completed!');
    console.log(`   Updated: ${updated} pools`);
    console.log(`   Skipped: ${skipped} pools`);
    console.log('\nNext step: Restart your server to load the updated pool data.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  }
}

migrateDatabase();
