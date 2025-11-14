#!/usr/bin/env node

/**
 * Migration Script: Add LP Tokens to Existing Pools
 *
 * This script:
 * 1. Loads all pools from PostgreSQL database
 * 2. Identifies pools without LP tokens
 * 3. Creates fungible LP tokens for each pool
 * 4. Mints LP tokens to existing liquidity providers
 * 5. Updates pool records with LP token addresses
 *
 * Usage:
 *   node migrate-pools-to-lp-tokens.mjs
 */

import { PoolRepository } from './server/keeta-impl/db/pool-repository.js';
import { initializeDatabase, closeDatabase } from './server/keeta-impl/db/client.js';
import {
  createLPToken,
  mintLPTokens,
  getOpsClient
} from './server/keeta-impl/utils/client.js';

async function migratePools() {
  console.log('🚀 Starting LP Token Migration for Existing Pools...\n');

  try {
    // Initialize database connection
    await initializeDatabase();
    console.log('✅ Database connected\n');

    const repository = new PoolRepository();

    // Load all pools from database
    const pools = await repository.loadPools();
    console.log(`📊 Found ${pools.length} pools in database\n`);

    if (pools.length === 0) {
      console.log('ℹ️ No pools found to migrate');
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const poolData of pools) {
      const poolAddress = poolData.pool_address;
      const tokenA = poolData.token_a;
      const tokenB = poolData.token_b;
      const existingLPToken = poolData.lp_token_address;

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 Pool: ${poolAddress.slice(-12)}`);
      console.log(`   Token A: ${tokenA.slice(-12)}`);
      console.log(`   Token B: ${tokenB.slice(-12)}`);

      // Skip pools that already have LP tokens
      if (existingLPToken) {
        console.log(`   ⏭️  Already has LP token: ${existingLPToken.slice(-12)}`);
        console.log(`   Status: SKIPPED`);
        skipped++;
        continue;
      }

      try {
        // Step 1: Create LP token for this pool
        console.log(`\n   [1/4] Creating LP token...`);
        const lpTokenAddress = await createLPToken(poolAddress, tokenA, tokenB);
        console.log(`   ✅ LP token created: ${lpTokenAddress}`);

        // Step 2: Get all LP positions for this pool
        console.log(`\n   [2/4] Loading LP positions from database...`);
        const positions = await repository.getLPPositions(poolAddress);
        console.log(`   📊 Found ${positions.length} liquidity providers`);

        if (positions.length === 0) {
          console.log(`   ⚠️  No liquidity providers found for this pool`);
        }

        // Step 3: Mint LP tokens to each liquidity provider
        console.log(`\n   [3/4] Minting LP tokens to liquidity providers...`);
        let mintedCount = 0;
        for (const position of positions) {
          const userAddress = position.user_address;
          const shares = BigInt(position.shares);

          if (shares > 0n) {
            try {
              await mintLPTokens(lpTokenAddress, userAddress, shares);
              console.log(`      ✅ Minted ${shares} LP tokens to ${userAddress.slice(0, 20)}...`);
              mintedCount++;
            } catch (err) {
              console.error(`      ❌ Failed to mint to ${userAddress.slice(0, 20)}...: ${err.message}`);
            }
          } else {
            console.log(`      ⏭️  Skipped ${userAddress.slice(0, 20)}... (0 shares)`);
          }
        }

        console.log(`   ✅ Minted LP tokens to ${mintedCount}/${positions.length} users`);

        // Step 4: Update pool record with LP token address
        console.log(`\n   [4/4] Updating pool record in database...`);
        await repository.updatePoolLPToken(poolAddress, lpTokenAddress);
        console.log(`   ✅ Database updated with LP token address`);

        console.log(`\n   ✅ Migration complete for pool ${poolAddress.slice(-12)}`);
        migrated++;

      } catch (err) {
        console.error(`\n   ❌ Migration failed for pool ${poolAddress.slice(-12)}`);
        console.error(`   Error: ${err.message}`);
        if (err.stack) {
          console.error(`   Stack: ${err.stack.split('\n').slice(0, 3).join('\n')}`);
        }
        failed++;
      }
    }

    // Summary
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 MIGRATION SUMMARY`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total pools: ${pools.length}`);
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⏭️  Skipped:  ${skipped} (already have LP tokens)`);
    console.log(`❌ Failed:   ${failed}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (migrated > 0) {
      console.log('🎉 Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Test adding liquidity to migrated pools');
      console.log('2. Test removing liquidity from migrated pools');
      console.log('3. Verify LP token balances on-chain');
      console.log('4. Update frontend to display LP token balances\n');
    } else if (skipped === pools.length) {
      console.log('ℹ️  All pools already have LP tokens - no migration needed');
    } else {
      console.log('⚠️  Some pools failed to migrate - check errors above');
    }

  } catch (err) {
    console.error('\n❌ FATAL ERROR during migration:');
    console.error(err);
  } finally {
    // Close database connection
    await closeDatabase();
    console.log('\n✅ Database connection closed');
  }
}

// Check if repository has updatePoolLPToken method, add if missing
async function ensureUpdateMethod() {
  const { PoolRepository } = await import('./server/keeta-impl/db/pool-repository.js');

  if (!PoolRepository.prototype.updatePoolLPToken) {
    console.log('⚠️  Adding updatePoolLPToken method to PoolRepository...');

    PoolRepository.prototype.updatePoolLPToken = async function(poolAddress, lpTokenAddress) {
      const { getDbPool } = await import('./server/keeta-impl/db/client.js');
      const pool = getDbPool();

      const query = `
        UPDATE pools
        SET lp_token_address = $1, updated_at = CURRENT_TIMESTAMP
        WHERE pool_address = $2
        RETURNING *;
      `;

      const result = await pool.query(query, [lpTokenAddress, poolAddress]);
      return result.rows[0];
    };

    console.log('✅ Method added\n');
  }
}

// Run migration
(async () => {
  await ensureUpdateMethod();
  await migratePools();
})().catch(err => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
