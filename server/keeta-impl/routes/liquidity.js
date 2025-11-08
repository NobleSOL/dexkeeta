// src/routes/liquidity.js
import express from 'express';
import { getPoolManager } from '../contracts/PoolManager.js';
import { Pool } from '../contracts/Pool.js';
import { toAtomic, getPairKey } from '../utils/constants.js';
import { fetchTokenDecimals, createUserClient } from '../utils/client.js';

const router = express.Router();

/**
 * Convert atomic bigint amount to human-readable string
 * @param {bigint} atomicAmount - Amount in atomic units
 * @param {number} decimals - Token decimals
 * @returns {string} Human-readable amount (e.g., "1.008974")
 */
function toHumanReadable(atomicAmount, decimals) {
  const amountNum = Number(atomicAmount) / Math.pow(10, decimals);
  // Use toFixed for precision, then parseFloat to remove trailing zeros
  return parseFloat(amountNum.toFixed(Math.min(decimals, 6))).toString();
}

/**
 * POST /api/liquidity/add
 * Add liquidity to a pool (permissionless - requires user seed)
 *
 * Body: {
 *   userSeed: string (64-char hex seed),
 *   tokenA: string,
 *   tokenB: string,
 *   amountADesired: string (human-readable),
 *   amountBDesired: string (human-readable),
 *   amountAMin?: string (human-readable),
 *   amountBMin?: string (human-readable)
 * }
 */
router.post('/add', async (req, res) => {
  try {
    const {
      userSeed,
      tokenA,
      tokenB,
      amountADesired,
      amountBDesired,
      amountAMin = '0',
      amountBMin = '0',
    } = req.body;

    if (!userSeed || !tokenA || !tokenB || !amountADesired || !amountBDesired) {
      return res.status(400).json({
        error: 'Missing required fields (userSeed, tokenA, tokenB, amountADesired, amountBDesired)',
      });
    }

    // Create user client from seed (for permissionless operations)
    const { client: userClient, address: userAddress } = createUserClient(userSeed);

    const poolManager = await getPoolManager();

    // Get decimals
    const decimalsA = await fetchTokenDecimals(tokenA);
    const decimalsB = await fetchTokenDecimals(tokenB);

    // Convert to atomic
    const amountADesiredAtomic = toAtomic(Number(amountADesired), decimalsA);
    const amountBDesiredAtomic = toAtomic(Number(amountBDesired), decimalsB);
    const amountAMinAtomic = toAtomic(Number(amountAMin), decimalsA);
    const amountBMinAtomic = toAtomic(Number(amountBMin), decimalsB);

    // Check if pool exists, if not create it
    const existingPool = poolManager.getPool(tokenA, tokenB);
    if (!existingPool) {
      console.log(`🏗️ Pool doesn't exist, creating new pool for ${tokenA} / ${tokenB}...`);
      await poolManager.createPool(tokenA, tokenB, userAddress);
    }

    // Add liquidity using user's client
    const result = await poolManager.addLiquidity(
      userClient,
      userAddress,
      tokenA,
      tokenB,
      amountADesiredAtomic,
      amountBDesiredAtomic,
      amountAMinAtomic,
      amountBMinAtomic
    );

    res.json({
      success: true,
      userAddress,
      result: {
        amountA: toHumanReadable(result.amountA, decimalsA),
        amountB: toHumanReadable(result.amountB, decimalsB),
        liquidity: result.liquidity.toString(),
        newReserveA: toHumanReadable(result.newReserveA, decimalsA),
        newReserveB: toHumanReadable(result.newReserveB, decimalsB),
      },
    });
  } catch (error) {
    console.error('Add liquidity error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/liquidity/remove
 * Remove liquidity from a pool (permissionless - requires user seed)
 *
 * Body: {
 *   userSeed: string (64-char hex seed),
 *   tokenA: string,
 *   tokenB: string,
 *   liquidity: string,
 *   amountAMin?: string (human-readable),
 *   amountBMin?: string (human-readable)
 * }
 */
router.post('/remove', async (req, res) => {
  try {
    const {
      userSeed,
      tokenA,
      tokenB,
      liquidity,
      amountAMin = '0',
      amountBMin = '0',
    } = req.body;

    if (!userSeed || !tokenA || !tokenB || !liquidity) {
      return res.status(400).json({
        error: 'Missing required fields (userSeed, tokenA, tokenB, liquidity)',
      });
    }

    // Create user client from seed (for permissionless operations)
    const { client: userClient, address: userAddress } = createUserClient(userSeed);

    const poolManager = await getPoolManager();

    // Get decimals for minimums
    const decimalsA = await fetchTokenDecimals(tokenA);
    const decimalsB = await fetchTokenDecimals(tokenB);

    const liquidityAtomic = BigInt(liquidity);
    const amountAMinAtomic = toAtomic(Number(amountAMin), decimalsA);
    const amountBMinAtomic = toAtomic(Number(amountBMin), decimalsB);

    // Remove liquidity
    const result = await poolManager.removeLiquidity(
      userAddress,
      tokenA,
      tokenB,
      liquidityAtomic,
      amountAMinAtomic,
      amountBMinAtomic
    );

    res.json({
      success: true,
      userAddress,
      result: {
        amountA: toHumanReadable(result.amountA, decimalsA),
        amountB: toHumanReadable(result.amountB, decimalsB),
        newReserveA: toHumanReadable(result.newReserveA, decimalsA),
        newReserveB: toHumanReadable(result.newReserveB, decimalsB),
      },
    });
  } catch (error) {
    console.error('Remove liquidity error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/liquidity/positions/:userAddress
 * Get user's LP positions across all pools
 */
router.get('/positions/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;

    if (!userAddress) {
      return res.status(400).json({
        error: 'Missing userAddress',
      });
    }

    const poolManager = await getPoolManager();
    const positions = await poolManager.getUserPositions(userAddress);

    res.json({
      success: true,
      positions,
    });
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/liquidity/register-pool
 * Register a user-created pool and grant ops permissions
 *
 * Body: {
 *   poolAddress: string,
 *   tokenA: string,
 *   tokenB: string,
 *   creatorAddress: string
 * }
 */
router.post('/register-pool', async (req, res) => {
  try {
    const { poolAddress, tokenA, tokenB, creatorAddress } = req.body;

    if (!poolAddress || !tokenA || !tokenB || !creatorAddress) {
      return res.status(400).json({
        error: 'Missing required fields (poolAddress, tokenA, tokenB, creatorAddress)',
      });
    }

    const poolManager = await getPoolManager();

    // Transfer ownership and grant ops permissions
    await poolManager.transferPoolOwnership(poolAddress, creatorAddress, tokenA, tokenB);

    // Create and register pool instance
    const pool = new Pool(poolAddress, tokenA, tokenB);
    await pool.initialize();

    const pairKey = getPairKey(tokenA, tokenB);
    poolManager.pools.set(pairKey, pool);
    poolManager.poolAddresses.set(pairKey, poolAddress);

    // Save to persistent storage
    await poolManager.savePools();

    res.json({
      success: true,
      poolAddress,
      message: 'Pool registered with ops permissions granted',
    });
  } catch (error) {
    console.error('Register pool error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
