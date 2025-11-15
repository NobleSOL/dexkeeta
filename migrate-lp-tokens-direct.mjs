#!/usr/bin/env node
/**
 * Direct database migration for LP tokens
 * Connects to production Render database and populates lp_token_address
 */

import * as KeetaSDK from '@keetanetwork/keetanet-client';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const KEETA_NETWORK = 'test';

// Production database URL from Render
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  console.error('Get it from: Render Dashboard → keeta-dex-backend → Environment → DATABASE_URL');
  process.exit(1);
}

async function findLpTokenForPool(client, poolAddress) {
  try {
    const accountsInfo = await client.client.getAccountsInfo([poolAddress]);
    const accountInfo = accountsInfo[poolAddress];

    if (!accountInfo?.info?.name) {
      console.warn(`  ⚠️ No account info for pool ${poolAddress.slice(-8)}`);
      return null;
    }

    // LP token is stored in pool's name field: "SILVERBACK_POOL|<lpTokenAddress>"
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

async function migrate() {
  console.log('🔧 Migrating LP token addresses in production database...\n');

  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Create Keeta client
    const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);

    // Load pools from database
    console.log('[1/2] Loading pools from database...');
    const result = await pool.query('SELECT * FROM pools ORDER BY created_at ASC');
    const pools = result.rows;
    console.log(`✅ Found ${pools.length} pools\n`);

    // Process each pool
    console.log('[2/2] Updating LP token addresses...\n');
    let updated = 0;
    let skipped = 0;

    for (const dbPool of pools) {
      const shortAddr = dbPool.pool_address.slice(-8);
      console.log(`📍 Processing pool ${shortAddr}...`);

      // Skip if already has LP token
      if (dbPool.lp_token_address) {
        console.log(`   ⏭️ Already has LP token: ${dbPool.lp_token_address.slice(-8)}\n`);
        skipped++;
        continue;
      }

      // Find LP token address from blockchain
      const lpTokenAddress = await findLpTokenForPool(client, dbPool.pool_address);

      if (lpTokenAddress) {
        // Update database
        await pool.query(
          'UPDATE pools SET lp_token_address = $1, updated_at = CURRENT_TIMESTAMP WHERE pool_address = $2',
          [lpTokenAddress, dbPool.pool_address]
        );
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
    console.log('\nServer will automatically reload pool data on next request.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
