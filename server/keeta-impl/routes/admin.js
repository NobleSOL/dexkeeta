// Admin routes for one-time operations
import express from 'express';
import { getOpsAccount, accountFromAddress, KeetaNet, createUserClient } from '../utils/client.js';
import { getPoolManager } from '../contracts/PoolManager.js';

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

export default router;
