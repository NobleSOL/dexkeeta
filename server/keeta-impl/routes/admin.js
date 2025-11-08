// Admin routes for one-time operations
import express from 'express';
import { getOpsAccount, accountFromAddress, KeetaNet, createUserClient } from '../utils/client.js';
import { getPoolManager } from '../contracts/PoolManager.js';
import { PoolRepository } from '../db/pool-repository.js';
import { initializeDatabase } from '../db/client.js';

const router = express.Router();

/**
 * POST /api/admin/fix-pool-permissions
 *
 * One-time endpoint to grant OPS permissions on existing pools
 * Requires pool owner's wallet seed
 *
 * Body: { walletSeed: string }
 */
router.post('/fix-pool-permissions', async (req, res) => {
  try {
    const { walletSeed } = req.body;

    if (!walletSeed) {
      return res.status(400).json({
        success: false,
        error: 'walletSeed is required',
      });
    }

    console.log('🔧 Starting permission fix...');

    // Get pool manager to access pools
    const poolManager = await getPoolManager();
    const pools = poolManager.getAllPools();

    console.log(`📋 Found ${pools.length} pools to check`);

    // Create user client
    const { client: userClient, account: userAccount } = createUserClient(walletSeed);
    const ops = getOpsAccount();
    const opsAddress = ops.publicKeyString.get();
    const userAddress = userAccount.publicKeyString.get();

    console.log('👤 Pool owner:', userAddress.slice(0, 30) + '...');
    console.log('🔧 Ops address:', opsAddress.slice(0, 30) + '...');

    const results = [];

    // Fix permissions for each pool
    for (const pool of pools) {
      const result = {
        poolAddress: pool.poolAddress,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        creator: pool.creator,
        success: false,
        message: '',
      };

      console.log(`\n🔧 Checking pool: ${pool.poolAddress}`);
      console.log(`   Creator: ${pool.creator || 'unknown'}`);

      // Check if user is the creator
      if (!pool.creator || pool.creator.toLowerCase() !== userAddress.toLowerCase()) {
        result.message = 'Not the pool creator - skipping';
        console.log(`   ⚠️ SKIPPING: User is not the creator`);
        results.push(result);
        continue;
      }

      try {
        const builder = userClient.initBuilder();
        const poolAccount = accountFromAddress(pool.poolAddress);

        // Grant Ops the necessary permissions: SEND_ON_BEHALF, STORAGE_DEPOSIT, ACCESS
        builder.updatePermissions(
          ops,
          new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'STORAGE_DEPOSIT', 'ACCESS']),
          undefined,
          undefined,
          { account: poolAccount }
        );

        console.log('   📝 Granting Ops: SEND_ON_BEHALF, STORAGE_DEPOSIT, ACCESS');

        await userClient.publishBuilder(builder);

        result.success = true;
        result.message = 'Permissions updated successfully';
        console.log('   ✅ Permissions updated successfully');
      } catch (err) {
        result.message = `Error: ${err.message}`;
        console.error(`   ❌ Error updating permissions:`, err.message);
      }

      results.push(result);
    }

    console.log('\n✅ Permission fix complete!');

    res.json({
      success: true,
      message: 'Permission fix completed',
      results,
    });
  } catch (error) {
    console.error('❌ Permission fix error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/fix-ride-pool-storage-permissions
 *
 * Fix permissions for RIDE/KTA pool token storage accounts
 * Grants OPS wallet SEND_ON_BEHALF and ACCESS on token storage within the pool
 *
 * Body: { walletSeed: string }
 */
router.post('/fix-ride-pool-storage-permissions', async (req, res) => {
  try {
    const { walletSeed } = req.body;

    if (!walletSeed) {
      return res.status(400).json({
        success: false,
        error: 'walletSeed is required',
      });
    }

    const RIDE_KTA_POOL = 'keeta_athjolef2zpnj6pimky2sbwbe6cmtdxakgixsveuck7fd7ql2vrf6mxkh4gy4';
    const RIDE_TOKEN = 'keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo';
    const KTA_TOKEN = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';

    console.log('🔧 Fixing RIDE/KTA Pool Storage Permissions\n');

    // Create user client
    const { client: creatorClient, address: creatorAddress } = createUserClient(walletSeed);
    const ops = getOpsAccount();

    console.log(`👤 Creator: ${creatorAddress}`);
    console.log(`🤖 OPS: ${ops.publicKeyString.get()}\n`);
    console.log(`📦 Pool: ${RIDE_KTA_POOL}`);
    console.log(`🪙 RIDE: ${RIDE_TOKEN}`);
    console.log(`🪙 KTA: ${KTA_TOKEN}\n`);

    const results = [];

    // Grant permissions on the pool account itself
    console.log('1️⃣ Granting permissions on pool account...');
    try {
      const poolAccount = accountFromAddress(RIDE_KTA_POOL);
      const builder1 = creatorClient.initBuilder();

      builder1.updatePermissions(
        ops,
        new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'STORAGE_DEPOSIT', 'ACCESS']),
        undefined,
        undefined,
        { account: poolAccount }
      );

      console.log('   🚀 Publishing...');
      await creatorClient.publishBuilder(builder1);
      console.log('   ✅ Pool account permissions granted\n');
      results.push({ target: 'pool_account', success: true });
    } catch (err) {
      console.error('   ❌ Error:', err.message);
      results.push({ target: 'pool_account', success: false, error: err.message });
    }

    // Grant permissions on RIDE token storage within pool
    console.log('2️⃣ Granting permissions on RIDE token storage...');
    try {
      const rideStoragePath = `${RIDE_KTA_POOL}/${RIDE_TOKEN}`;
      const rideStorageAccount = accountFromAddress(rideStoragePath);
      const builder2 = creatorClient.initBuilder();

      builder2.updatePermissions(
        ops,
        new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'ACCESS']),
        undefined,
        undefined,
        { account: rideStorageAccount }
      );

      console.log('   🚀 Publishing...');
      await creatorClient.publishBuilder(builder2);
      console.log('   ✅ RIDE storage permissions granted\n');
      results.push({ target: 'ride_storage', success: true });
    } catch (err) {
      console.error('   ❌ Error:', err.message);
      results.push({ target: 'ride_storage', success: false, error: err.message });
    }

    // Grant permissions on KTA token storage within pool
    console.log('3️⃣ Granting permissions on KTA token storage...');
    try {
      const ktaStoragePath = `${RIDE_KTA_POOL}/${KTA_TOKEN}`;
      const ktaStorageAccount = accountFromAddress(ktaStoragePath);
      const builder3 = creatorClient.initBuilder();

      builder3.updatePermissions(
        ops,
        new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'ACCESS']),
        undefined,
        undefined,
        { account: ktaStorageAccount }
      );

      console.log('   🚀 Publishing...');
      await creatorClient.publishBuilder(builder3);
      console.log('   ✅ KTA storage permissions granted\n');
      results.push({ target: 'kta_storage', success: true });
    } catch (err) {
      console.error('   ❌ Error:', err.message);
      results.push({ target: 'kta_storage', success: false, error: err.message });
    }

    console.log('✅ All permissions granted successfully!');
    console.log('🎉 RIDE/KTA pool is now ready for swaps\n');

    res.json({
      success: true,
      message: 'RIDE/KTA pool permissions fixed',
      results,
    });
  } catch (error) {
    console.error('\n❌ Permission grant failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/init-database
 *
 * Initialize PostgreSQL database schema (tables, indexes, triggers)
 * Safe to run multiple times - uses IF NOT EXISTS
 */
router.post('/init-database', async (req, res) => {
  try {
    console.log('📊 Initializing PostgreSQL database schema...\n');

    await initializeDatabase();

    console.log('✅ Database initialized successfully!\n');

    res.json({
      success: true,
      message: 'Database schema initialized',
    });
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/sync-lp-positions
 *
 * One-time sync of LP positions to PostgreSQL database
 * Adds initial LP position data for both KTA/WAVE and RIDE/KTA pools
 */
router.post('/sync-lp-positions', async (req, res) => {
  try {
    console.log('🚀 Syncing initial LP positions to PostgreSQL\n');

    const repository = new PoolRepository();

    // Your wallet address
    const userAddress = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi';

    // KTA/WAVE pool - from .liquidity-positions-tzej2lvm.json
    const ktaWavePool = 'keeta_athz5k3zcwdkhvbhkso3ac34uhanucgzhd2gn3tfhuahgzaljslostzej2lvm';
    const ktaWaveShares = '3162277660';

    console.log(`📦 Adding LP position for KTA/WAVE pool...`);
    await repository.saveLPPosition(ktaWavePool, userAddress, BigInt(ktaWaveShares));
    console.log(`✅ Saved: ${ktaWaveShares} shares in pool ${ktaWavePool}`);

    // RIDE/KTA pool - creator position (you created this pool)
    const rideKtaPool = 'keeta_athjolef2zpnj6pimky2sbwbe6cmtdxakgixsveuck7fd7ql2vrf6mxkh4gy4';

    console.log(`\n📦 Adding LP position for RIDE/KTA pool...`);
    console.log(`   (Creator position - will be calculated from reserves)`);
    // Use 1 as placeholder - actual shares calculated from reserves
    await repository.saveLPPosition(rideKtaPool, userAddress, 1n);
    console.log(`✅ Saved: Creator position for pool ${rideKtaPool}`);

    console.log('\n✅ LP position sync complete!\n');

    res.json({
      success: true,
      message: 'LP positions synced to database',
      positions: [
        { pool: ktaWavePool, shares: ktaWaveShares },
        { pool: rideKtaPool, shares: 'creator_position' },
      ],
    });
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
