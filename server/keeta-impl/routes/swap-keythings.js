// Keythings wallet swap endpoint
// Completes swaps after user has sent tokens via TX1 (signed in Keythings)
import express from 'express';
import { getPoolManager } from '../contracts/PoolManager.js';
import { getOpsClient, accountFromAddress } from '../utils/client.js';

const router = express.Router();

/**
 * POST /api/swap/keythings/complete
 * Complete a Keythings wallet swap by sending output tokens to user
 *
 * Flow:
 * 1. User already sent TX1 via Keythings (tokenIn → pool + treasury)
 * 2. This endpoint executes TX2: pool → user (tokenOut) using SEND_ON_BEHALF
 *
 * Body: {
 *   userAddress: string,
 *   poolAddress: string,
 *   tokenOut: string,
 *   amountOut: string (atomic units as string)
 * }
 */
router.post('/complete', async (req, res) => {
  try {
    const { userAddress, poolAddress, tokenOut, amountOut } = req.body;

    console.log('🔄 Completing Keythings swap (TX2)...');
    console.log(`   User: ${userAddress.slice(0, 12)}...`);
    console.log(`   Pool: ${poolAddress.slice(0, 12)}...`);
    console.log(`   Token Out: ${tokenOut.slice(0, 12)}...`);
    console.log(`   Amount Out: ${amountOut}`);

    if (!userAddress || !poolAddress || !tokenOut || !amountOut) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, poolAddress, tokenOut, amountOut',
      });
    }

    const opsClient = await getOpsClient();
    const poolManager = await getPoolManager();

    // Find the pool instance
    const pool = Array.from(poolManager.pools.values()).find(
      (p) => p.poolAddress === poolAddress
    );

    if (!pool) {
      throw new Error(`Pool not found: ${poolAddress}`);
    }

    // TX2: Pool sends tokenOut to user (using SEND_ON_BEHALF)
    console.log('📝 TX2: Pool sends tokenOut to user (via SEND_ON_BEHALF)...');

    const tokenOutAccount = accountFromAddress(tokenOut);
    const userAccount = accountFromAddress(userAddress);
    const poolAccount = accountFromAddress(poolAddress);

    const tx2Builder = opsClient.initBuilder();

    // Pool sends tokenOut to user using SEND_ON_BEHALF
    // { account: poolAccount } tells OPS to send on behalf of pool account
    tx2Builder.send(
      userAccount,
      BigInt(amountOut),
      tokenOutAccount,
      undefined,
      { account: poolAccount }
    );

    await opsClient.publishBuilder(tx2Builder);

    // Extract TX2 block hash
    let tx2Hash = null;
    if (tx2Builder.blocks && tx2Builder.blocks.length > 0) {
      const block = tx2Builder.blocks[0];
      if (block && block.hash) {
        if (typeof block.hash === 'string') {
          tx2Hash = block.hash.toUpperCase();
        } else if (block.hash.toString) {
          const hashStr = block.hash.toString();
          if (hashStr.match(/^[0-9A-Fa-f]+$/)) {
            tx2Hash = hashStr.toUpperCase();
          } else if (block.hash.toString('hex')) {
            tx2Hash = block.hash.toString('hex').toUpperCase();
          }
        }
      }
    }

    console.log(`✅ TX2 completed: ${tx2Hash || 'no hash'}`);

    // Update pool reserves after swap
    await pool.updateReserves();

    res.json({
      success: true,
      result: {
        blockHash: tx2Hash,
        amountOut: amountOut,
      },
    });
  } catch (error) {
    console.error('❌ Keythings swap completion error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
