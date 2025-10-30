// src/contracts/PoolManager.js
import { Pool } from './Pool.js';
import { createStorageAccount } from '../utils/client.js';
import { getPairKey } from '../utils/constants.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Manages all liquidity pools in the DEX
 * Handles pool creation, discovery, and routing
 */
export class PoolManager {
  constructor() {
    this.pools = new Map(); // pairKey -> Pool instance
    this.poolAddresses = new Map(); // pairKey -> pool address
    this.persistencePath = '.pools.json'; // Store pool addresses
  }

  /**
   * Initialize the pool manager (load existing pools)
   */
  async initialize() {
    await this.loadPools();
    console.log(`✅ PoolManager initialized with ${this.pools.size} pools`);
    return this;
  }

  /**
   * Load pool addresses from persistent storage
   */
  async loadPools() {
    try {
      const data = await fs.readFile(this.persistencePath, 'utf8');
      const poolData = JSON.parse(data);
      
      for (const [pairKey, poolInfo] of Object.entries(poolData)) {
        this.poolAddresses.set(pairKey, poolInfo.address);

        // Initialize pool instance with LP token address if available
        const pool = new Pool(
          poolInfo.address,
          poolInfo.tokenA,
          poolInfo.tokenB,
          poolInfo.lpTokenAddress || null
        );
        await pool.initialize();
        this.pools.set(pairKey, pool);

        console.log(`📦 Loaded pool: ${pairKey} at ${poolInfo.address}`);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('⚠️ Could not load pools:', err.message);
      }
    }
  }

  /**
   * Save pool addresses to persistent storage
   */
  async savePools() {
    const poolData = {};

    for (const [pairKey, pool] of this.pools.entries()) {
      poolData[pairKey] = {
        address: pool.poolAddress,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        lpTokenAddress: pool.lpTokenAddress,
      };
    }

    await fs.writeFile(this.persistencePath, JSON.stringify(poolData, null, 2));
  }

  /**
   * Transfer pool ownership from Ops to creator
   * Ops maintains SEND_ON_BEHALF permissions to act as router
   *
   * @param {string} poolAddress - Pool storage account address
   * @param {string} creatorAddress - Creator's account address
   * @param {string} tokenA - First token address (not used currently)
   * @param {string} tokenB - Second token address (not used currently)
   */
  async transferPoolOwnership(poolAddress, creatorAddress, tokenA, tokenB) {
    const { getOpsClient, getOpsAccount, accountFromAddress, KeetaNet } = await import('../utils/client.js');

    const client = await getOpsClient();
    const ops = getOpsAccount();
    const builder = client.initBuilder();

    const poolAccount = accountFromAddress(poolAddress);
    const creatorAccount = accountFromAddress(creatorAddress);

    // Grant OWNER to creator
    builder.updatePermissions(
      creatorAccount,
      new KeetaNet.lib.Permissions(['OWNER']),
      undefined,
      undefined,
      { account: poolAccount }
    );

    // Update Ops permissions: keep SEND_ON_BEHALF plus STORAGE_DEPOSIT and ACCESS
    // These are needed to interact with token storage accounts within the pool
    builder.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'STORAGE_DEPOSIT', 'ACCESS']),
      undefined,
      undefined,
      { account: poolAccount }
    );

    await client.publishBuilder(builder);

    console.log(`✅ Transferred ownership of pool ${poolAddress.slice(0, 20)}... to ${creatorAddress.slice(0, 20)}...`);
    console.log(`   Ops retains SEND_ON_BEHALF permissions for routing`);
  }

  /**
   * Create a new pool for a token pair (permissionless)
   *
   * @param {string} tokenA - Token A address
   * @param {string} tokenB - Token B address
   * @param {string} creatorAddress - Address of the pool creator who will own the pool
   * @returns {Promise<Pool>}
   */
  async createPool(tokenA, tokenB, creatorAddress) {
    const pairKey = getPairKey(tokenA, tokenB);

    // Check if pool already exists
    if (this.pools.has(pairKey)) {
      throw new Error(`Pool already exists for ${pairKey}`);
    }

    console.log(`🏗️ Creating new pool for ${pairKey}...`);

    // Create storage account for the pool
    // Use pool letter to keep name short (max 50 chars, A-Z_ only, no numbers)
    const poolIndex = this.pools.size;
    const poolLetter = String.fromCharCode(65 + poolIndex); // A, B, C, etc.
    const poolAddress = await createStorageAccount(
      `SILVERBACK_POOL_${poolLetter}`,
      `Liquidity pool for ${tokenA.slice(0, 12)}... / ${tokenB.slice(0, 12)}...`
    );

    console.log(`✅ Pool created at ${poolAddress}`);

    // Transfer ownership to creator, Ops keeps SEND_ON_BEHALF for routing
    await this.transferPoolOwnership(poolAddress, creatorAddress, tokenA, tokenB);

    // Create and initialize pool instance
    const pool = new Pool(poolAddress, tokenA, tokenB);
    await pool.initialize();

    // Register pool
    this.pools.set(pairKey, pool);
    this.poolAddresses.set(pairKey, poolAddress);

    // Persist to storage
    await this.savePools();

    return pool;
  }

  /**
   * Get a pool by token pair
   * 
   * @param {string} tokenA
   * @param {string} tokenB
   * @returns {Pool | null}
   */
  getPool(tokenA, tokenB) {
    const pairKey = getPairKey(tokenA, tokenB);
    return this.pools.get(pairKey) || null;
  }

  /**
   * Get pool by address
   */
  getPoolByAddress(poolAddress) {
    for (const pool of this.pools.values()) {
      if (pool.poolAddress === poolAddress) {
        return pool;
      }
    }
    return null;
  }

  /**
   * Get all pools
   */
  getAllPools() {
    return Array.from(this.pools.values());
  }

  /**
   * Get pool info for all pools
   */
  async getAllPoolsInfo() {
    const poolsInfo = [];
    
    for (const pool of this.pools.values()) {
      const info = await pool.getPoolInfo();
      poolsInfo.push(info);
    }
    
    return poolsInfo;
  }

  /**
   * Find best route for a swap (simple implementation - direct swap only)
   * In future, this could handle multi-hop swaps
   * 
   * @param {string} tokenIn
   * @param {string} tokenOut
   * @returns {Pool | null}
   */
  findSwapRoute(tokenIn, tokenOut) {
    // For now, just return direct pool if it exists
    return this.getPool(tokenIn, tokenOut);
  }

  /**
   * Execute a swap (finds route automatically)
   *
   * @param {Object} userClient - User's KeetaNet client (from createUserClient)
   * @param {string} userAddress
   * @param {string} tokenIn
   * @param {string} tokenOut
   * @param {bigint} amountIn
   * @param {bigint} minAmountOut
   */
  async swap(userClient, userAddress, tokenIn, tokenOut, amountIn, minAmountOut = 0n) {
    const pool = this.findSwapRoute(tokenIn, tokenOut);

    if (!pool) {
      throw new Error(`No pool found for ${tokenIn} -> ${tokenOut}`);
    }

    return await pool.swap(userClient, userAddress, tokenIn, amountIn, minAmountOut);
  }

  /**
   * Get swap quote (without executing)
   */
  async getSwapQuote(tokenIn, tokenOut, amountIn) {
    const pool = this.findSwapRoute(tokenIn, tokenOut);
    
    if (!pool) {
      throw new Error(`No pool found for ${tokenIn} -> ${tokenOut}`);
    }
    
    return await pool.getSwapQuote(tokenIn, amountIn);
  }

  /**
   * Add liquidity to a pool
   * @param {Object} userClient - User's KeetaNet client (from createUserClient)
   * @param {string} userAddress - User's account address
   */
  async addLiquidity(
    userClient,
    userAddress,
    tokenA,
    tokenB,
    amountADesired,
    amountBDesired,
    amountAMin = 0n,
    amountBMin = 0n
  ) {
    const pool = this.getPool(tokenA, tokenB);

    if (!pool) {
      throw new Error(`No pool found for ${tokenA} / ${tokenB}`);
    }

    return await pool.addLiquidity(
      userClient,
      userAddress,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin
    );
  }

  /**
   * Remove liquidity from a pool
   */
  async removeLiquidity(
    userAddress,
    tokenA,
    tokenB,
    liquidity,
    amountAMin = 0n,
    amountBMin = 0n
  ) {
    const pool = this.getPool(tokenA, tokenB);
    
    if (!pool) {
      throw new Error(`No pool found for ${tokenA} / ${tokenB}`);
    }
    
    return await pool.removeLiquidity(userAddress, liquidity, amountAMin, amountBMin);
  }

  /**
   * Get user's LP position across all pools
   */
  async getUserPositions(userAddress) {
    const positions = [];

    console.log(`📊 Checking positions for ${userAddress} across ${this.pools.size} pools`);

    for (const pool of this.pools.values()) {
      try {
        const position = await pool.getUserLPBalance(userAddress);

        console.log(`  Pool ${pool.poolAddress.slice(-8)}: lpBalance=${position.lpBalance}, shares=${position.sharePercent}%`);

        // Check if position exists and has lpBalance
        if (position && position.lpBalance && BigInt(position.lpBalance) > 0n) {
          // Fetch token symbols
          const symbolA = await pool.getTokenSymbol(pool.tokenA);
          const symbolB = await pool.getTokenSymbol(pool.tokenB);

          positions.push({
            poolAddress: pool.poolAddress,
            lpStorageAddress: position.lpStorageAddress, // User's LP storage account
            tokenA: pool.tokenA,
            tokenB: pool.tokenB,
            symbolA,
            symbolB,
            liquidity: position.lpBalance, // Frontend expects 'liquidity' not 'lpBalance'
            sharePercent: position.sharePercent,
            amountA: position.amountAHuman, // Use human-readable format
            amountB: position.amountBHuman, // Use human-readable format
            timestamp: Date.now(), // Add timestamp for frontend display
          });
        }
      } catch (error) {
        console.error(`Error getting LP balance for pool ${pool.poolAddress}:`, error.message);
        // Continue to next pool instead of failing completely
      }
    }

    console.log(`✅ Found ${positions.length} positions with liquidity`);
    return positions;
  }

  /**
   * Check if pool exists
   */
  hasPool(tokenA, tokenB) {
    const pairKey = getPairKey(tokenA, tokenB);
    return this.pools.has(pairKey);
  }

  /**
   * Get statistics for a pool
   */
  async getPoolStats(tokenA, tokenB) {
    const pool = this.getPool(tokenA, tokenB);
    
    if (!pool) {
      throw new Error(`No pool found for ${tokenA} / ${tokenB}`);
    }
    
    const info = await pool.getPoolInfo();
    
    // Calculate TVL (in BASE token equivalent)
    // For simplicity, assume tokenA is BASE
    const tvlInBase = info.reserveAHuman * 2; // Rough estimate
    
    return {
      ...info,
      tvl: tvlInBase,
      volume24h: 0, // TODO: Track volume
      fees24h: 0, // TODO: Track fees
      lpHolders: 0, // TODO: Track total LP holders count
    };
  }
}

// Singleton instance
let poolManagerInstance = null;

/**
 * Get the singleton PoolManager instance
 */
export async function getPoolManager() {
  if (!poolManagerInstance) {
    poolManagerInstance = new PoolManager();
    await poolManagerInstance.initialize();
  }
  return poolManagerInstance;
}
