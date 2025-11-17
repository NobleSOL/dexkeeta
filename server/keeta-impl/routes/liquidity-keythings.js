// Keythings wallet liquidity endpoint
// Completes add liquidity after user has sent tokens via TX1 (signed in Keythings)
import express from 'express';
import { getPoolManager } from '../contracts/PoolManager.js';
import { getOpsClient, accountFromAddress } from '../utils/client.js';
import { toAtomic } from '../utils/constants.js';
import { fetchTokenDecimals } from '../utils/client.js';

const router = express.Router();

/**
 * POST /api/liquidity/keythings/complete
 * Complete a Keythings wallet add liquidity by minting LP tokens to user
 *
 * Flow:
 * 1. User already sent TX1 via Keythings (tokenA + tokenB → pool)
 * 2. This endpoint executes TX2: mint LP tokens to user using OPS account
 *
 * Body: {
 *   userAddress: string,
 *   poolAddress: string,
 *   tokenA: string,
 *   tokenB: string,
 *   amountA: string (atomic units as string),
 *   amountB: string (atomic units as string)
 * }
 */
router.post('/complete', async (req, res) => {
  try {
    console.log('💧 Keythings add liquidity /complete endpoint called');
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

    const { userAddress, poolAddress, tokenA, tokenB, amountA, amountB } = req.body;

    if (!userAddress || !poolAddress || !tokenA || !tokenB || !amountA || !amountB) {
      console.error('❌ Missing required fields!');
      console.error('   Received:', { userAddress: !!userAddress, poolAddress: !!poolAddress, tokenA: !!tokenA, tokenB: !!tokenB, amountA: !!amountA, amountB: !!amountB });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, poolAddress, tokenA, tokenB, amountA, amountB',
        received: req.body,
      });
    }

    console.log('✅ All required fields present');
    console.log(`   User: ${userAddress.slice(0, 12)}...`);
    console.log(`   Pool: ${poolAddress.slice(0, 12)}...`);
    console.log(`   Token A: ${tokenA.slice(0, 12)}...`);
    console.log(`   Token B: ${tokenB.slice(0, 12)}...`);
    console.log(`   Amount A: ${amountA}`);
    console.log(`   Amount B: ${amountB}`);

    const opsClient = await getOpsClient();
    const poolManager = await getPoolManager();

    // Find the pool instance
    const pool = Array.from(poolManager.pools.values()).find(
      (p) => p.poolAddress === poolAddress
    );

    if (!pool) {
      throw new Error(`Pool not found: ${poolAddress}`);
    }

    // Get current reserves to calculate LP shares
    await pool.updateReserves();
    const reserveA = pool.reserveA;
    const reserveB = pool.reserveB;

    // Ensure LP token address is available before fetching total supply
    if (!pool.lpTokenAddress) {
      console.log('⚠️ LP token address not set on pool, looking up from database...');
      // Look up LP token from database
      const poolData = await poolManager.repository.getPoolByAddress(poolAddress);
      if (poolData && poolData.lp_token_address) {
        pool.lpTokenAddress = poolData.lp_token_address;
        console.log(`   Found LP token in database: ${pool.lpTokenAddress}`);
      }

      if (!pool.lpTokenAddress) {
        throw new Error('LP token address not found for pool. Pool may need to be recreated.');
      }
    }

    // Fetch total supply from LP token account
    let totalSupply = 0n;
    try {
      const lpTokenAccountInfo = await opsClient.client.getAccountsInfo([pool.lpTokenAddress]);
      const lpTokenInfo = lpTokenAccountInfo[pool.lpTokenAddress];

      if (lpTokenInfo?.info?.supply) {
        totalSupply = BigInt(lpTokenInfo.info.supply);
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch LP token supply, assuming first liquidity:', err.message);
      totalSupply = 0n;
    }

    console.log('📊 Current pool state:', {
      reserveA: reserveA.toString(),
      reserveB: reserveB.toString(),
      totalSupply: totalSupply.toString(),
    });

    // Calculate LP shares to mint
    const amountABigInt = BigInt(amountA);
    const amountBBigInt = BigInt(amountB);

    let liquidity;
    if (totalSupply === 0n) {
      // First liquidity - geometric mean minus MINIMUM_LIQUIDITY
      const MINIMUM_LIQUIDITY = 1000n;
      liquidity = sqrt(amountABigInt * amountBBigInt) - MINIMUM_LIQUIDITY;
      console.log('🆕 First liquidity provision');
    } else {
      // Subsequent liquidity - proportional to reserves
      const liquidityA = (amountABigInt * totalSupply) / reserveA;
      const liquidityB = (amountBBigInt * totalSupply) / reserveB;
      liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
      console.log('➕ Adding to existing liquidity');
    }

    console.log(`💎 LP shares to mint: ${liquidity}`);

    if (liquidity <= 0n) {
      throw new Error('Insufficient liquidity minted');
    }

    // TX2: Mint LP tokens to user
    console.log('📝 TX2: Minting LP tokens to user...');

    // Ensure LP token address is available
    if (!pool.lpTokenAddress) {
      console.log('⚠️ LP token address not set on pool, looking up from database...');
      // Look up LP token from database
      const poolData = await poolManager.repository.getPoolByAddress(poolAddress);
      if (poolData && poolData.lp_token_address) {
        pool.lpTokenAddress = poolData.lp_token_address;
        console.log(`   Found LP token in database: ${pool.lpTokenAddress}`);
      }

      if (!pool.lpTokenAddress) {
        throw new Error('LP token address not found for pool. Pool may need to be recreated.');
      }
    }

    const userAccount = accountFromAddress(userAddress);
    const poolAccount = accountFromAddress(poolAddress);
    const lpTokenAccount = accountFromAddress(pool.lpTokenAddress);

    const tx2Builder = opsClient.initBuilder();

    // Mint LP tokens to user using SEND_ON_BEHALF (OPS acts on behalf of LP token)
    tx2Builder.send(
      userAccount,
      liquidity,
      undefined, // undefined token = native KTA (but we're sending custom token)
      undefined,
      {
        account: lpTokenAccount, // Send from LP token account
        token: lpTokenAccount,   // The token being sent is the LP token itself
      }
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

    // Update pool reserves and total supply
    pool.reserveA = reserveA + amountABigInt;
    pool.reserveB = reserveB + amountBBigInt;
    pool.totalSupply = totalSupply + liquidity;

    // Save LP position to database
    await poolManager.repository.saveLPPosition(
      userAddress,
      poolAddress,
      tokenA,
      tokenB,
      liquidity.toString()
    );

    console.log('💾 Saved LP position to database');

    // Get decimals for human-readable response
    const decimalsA = await fetchTokenDecimals(tokenA);
    const decimalsB = await fetchTokenDecimals(tokenB);

    res.json({
      success: true,
      result: {
        blockHash: tx2Hash,
        liquidity: liquidity.toString(),
        amountA: (Number(amountA) / Math.pow(10, decimalsA)).toString(),
        amountB: (Number(amountB) / Math.pow(10, decimalsB)).toString(),
        newReserveA: (Number(pool.reserveA) / Math.pow(10, decimalsA)).toString(),
        newReserveB: (Number(pool.reserveB) / Math.pow(10, decimalsB)).toString(),
      },
    });
  } catch (error) {
    console.error('❌ Keythings add liquidity completion error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Integer square root (for first liquidity calculation)
 * @param {bigint} value
 * @returns {bigint}
 */
function sqrt(value) {
  if (value < 0n) {
    throw new Error('Square root of negative numbers is not supported');
  }
  if (value < 2n) {
    return value;
  }

  function newtonIteration(n, x0) {
    const x1 = (n / x0 + x0) >> 1n;
    if (x0 === x1 || x0 === x1 - 1n) {
      return x0;
    }
    return newtonIteration(n, x1);
  }

  return newtonIteration(value, 1n);
}

export default router;
