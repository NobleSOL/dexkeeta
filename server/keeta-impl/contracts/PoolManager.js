// src/contracts/PoolManager.js
import { Pool } from './Pool.js';
import { createStorageAccount } from '../utils/client.js';
import { getPairKey } from '../utils/constants.js';
import { PoolRepository } from '../db/pool-repository.js';
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
    this.repository = new PoolRepository(); // PostgreSQL repository
    this.persistencePath = '.pools.json'; // Legacy file storage (fallback)
  }

  /**
   * Initialize the pool manager (load existing pools)
   */
  async initialize() {
    await this.loadPools();

    // Discover pools on-chain (in case persistent storage was lost)
    // This ensures pools survive server restarts/redeployments
    await this.discoverPoolsOnChain();

    console.log(`✅ PoolManager initialized with ${this.pools.size} pools`);
    return this;
  }

  /**
   * Load pool addresses from PostgreSQL database
   */
  async loadPools() {
    try {
      const poolData = await this.repository.loadPools();

      for (const row of poolData) {
        const pairKey = getPairKey(row.token_a, row.token_b);
        this.poolAddresses.set(pairKey, row.pool_address);

        // Initialize pool instance with LP token address if available
        const pool = new Pool(
          row.pool_address,
          row.token_a,
          row.token_b,
          row.lp_token_address || null
        );
        pool.creator = row.creator || null; // Set creator/owner
        await pool.initialize();
        this.pools.set(pairKey, pool);

        console.log(`📦 Loaded pool: ${pairKey} at ${row.pool_address}`);
      }
    } catch (err) {
      console.error('⚠️ Could not load pools from database:', err.message);
      // Fallback to file-based storage if database fails
      await this.loadPoolsFromFile();
    }
  }

  /**
   * Fallback: Load pool addresses from legacy .pools.json file
   */
  async loadPoolsFromFile() {
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
        pool.creator = poolInfo.creator || null; // Set creator/owner
        await pool.initialize();
        this.pools.set(pairKey, pool);

        console.log(`📦 Loaded pool from file: ${pairKey} at ${poolInfo.address}`);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('⚠️ Could not load pools from file:', err.message);
      }
    }
  }

  /**
   * Save single pool to PostgreSQL database
   */
  async savePool(pool) {
    try {
      await this.repository.savePool({
        poolAddress: pool.poolAddress,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        lpTokenAddress: pool.lpTokenAddress,
        creator: pool.creator || null,
      });
    } catch (err) {
      console.error('⚠️ Could not save pool to database:', err.message);
      throw err;
    }
  }

  /**
   * Legacy: Save pool addresses to .pools.json file
   */
  async savePools() {
    const poolData = {};

    for (const [pairKey, pool] of this.pools.entries()) {
      poolData[pairKey] = {
        address: pool.poolAddress,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        lpTokenAddress: pool.lpTokenAddress,
        creator: pool.creator || null, // Track pool creator/owner
      };
    }

    await fs.writeFile(this.persistencePath, JSON.stringify(poolData, null, 2));
  }

  /**
   * Discover pools on-chain by scanning for STORAGE accounts with SILVERBACK_POOL names
   * This allows automatic recovery if persistent storage (.pools.json) is lost
   */
  async discoverPoolsOnChain() {
    try {
      console.log('🔍 Discovering pools on-chain...');

      const { getOpsClient, accountFromAddress } = await import('../utils/client.js');
      const client = await getOpsClient();

      // Known pool addresses to check
      const KNOWN_POOL_ADDRESSES = [
        'keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek', // KTA/WAVE (updated)
        'keeta_athjolef2zpnj6pimky2sbwbe6cmtdxakgixsveuck7fd7ql2vrf6mxkh4gy4', // KTA/RIDE
      ];

      let discovered = 0;

      for (const poolAddress of KNOWN_POOL_ADDRESSES) {
        try {
          // Skip if already loaded
          if (this.getPoolByAddress(poolAddress)) {
            console.log(`  Pool ${poolAddress.slice(-8)} already loaded`);
            continue;
          }

          // Try to get balances to identify tokens
          const poolAccount = accountFromAddress(poolAddress);
          const balances = await client.allBalances({ account: poolAccount });

          if (!balances || balances.length < 2) {
            console.log(`  Pool ${poolAddress.slice(-8)} has insufficient tokens`);
            continue;
          }

          // Extract token addresses from balances
          const tokenAddresses = balances
            .map(b => {
              // Try different ways to get the token address
              const token = b.token?.publicKeyString?.get?.() ||
                           b.token?.publicKeyString?.toString() ||
                           b.token?.toString();
              return token;
            })
            .filter(addr => addr && addr.startsWith('keeta_'));

          if (tokenAddresses.length < 2) {
            console.log(`  Pool ${poolAddress.slice(-8)} has less than 2 valid tokens`);
            continue;
          }

          const [tokenA, tokenB] = tokenAddresses;
          const pairKey = getPairKey(tokenA, tokenB);

          // Skip if pair already exists (different address)
          if (this.pools.has(pairKey)) {
            console.log(`  Pair ${pairKey} already exists at different address`);
            continue;
          }

          // Create and initialize pool
          const pool = new Pool(poolAddress, tokenA, tokenB);
          await pool.initialize();

          this.pools.set(pairKey, pool);
          this.poolAddresses.set(pairKey, poolAddress);

          discovered++;

          // Get token symbols for logging
          const symbolA = await pool.getTokenSymbol(tokenA);
          const symbolB = await pool.getTokenSymbol(tokenB);

          console.log(`✅ Discovered pool: ${symbolA}/${symbolB} at ${poolAddress.slice(-8)}`);
        } catch (err) {
          console.warn(`⚠️ Error checking pool ${poolAddress.slice(-8)}:`, err.message);
        }
      }

      if (discovered > 0) {
        console.log(`🎉 Discovered ${discovered} new pools on-chain`);
        // Save discovered pools to database
        for (const pool of this.pools.values()) {
          try {
            await this.savePool(pool);
          } catch (err) {
            console.warn(`⚠️ Failed to save pool ${pool.poolAddress}:`, err.message);
          }
        }
      } else {
        console.log('✓ No new pools discovered');
      }
    } catch (error) {
      console.error('❌ Error discovering pools on-chain:', error);
    }
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
   * CENTRALIZED LIQUIDITY MODEL:
   * - OPS owns all pools (can publish TX2 to complete swaps)
   * - Any user can trade (TX1 only requires having tokens)
   * - Creator tracked for informational purposes
   *
   * @param {string} tokenA - Token A address
   * @param {string} tokenB - Token B address
   * @param {string} creatorAddress - Address of the pool creator (for tracking only)
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
    // OPS will remain the owner (centralized liquidity model)
    const poolIndex = this.pools.size;
    const poolLetter = String.fromCharCode(65 + poolIndex); // A, B, C, etc.
    const poolAddress = await createStorageAccount(
      `SILVERBACK_POOL_${poolLetter}`,
      `Liquidity pool for ${tokenA.slice(0, 12)}... / ${tokenB.slice(0, 12)}...`,
      true // isPool flag - enables SEND_ON_BEHALF for permissionless swaps
    );

    console.log(`✅ Pool created at ${poolAddress}`);
    console.log(`   Transferring ownership to creator: ${creatorAddress.slice(0, 20)}...`);

    // Transfer ownership to creator while maintaining OPS SEND_ON_BEHALF permission
    await this.transferPoolOwnership(poolAddress, creatorAddress, tokenA, tokenB);

    // Create and initialize pool instance
    const pool = new Pool(poolAddress, tokenA, tokenB);
    pool.creator = creatorAddress; // Track who created the pool
    await pool.initialize();

    // Register pool
    this.pools.set(pairKey, pool);
    this.poolAddresses.set(pairKey, poolAddress);

    // Persist to database
    await this.savePool(pool);

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
   * Uses PostgreSQL database for persistent LP position tracking
   */
  async getUserPositions(userAddress) {
    const positions = [];

    console.log(`📊 Checking positions for ${userAddress} from database`);

    try {
      // Query LP positions from PostgreSQL database
      const dbPositions = await this.repository.getUserPositions(userAddress);

      console.log(`📋 Found ${dbPositions.length} positions in database`);

      for (const dbPos of dbPositions) {
        try {
          // Get the pool instance to access current reserves
          let pool = this.getPool(dbPos.token_a, dbPos.token_b);

          // If pool not loaded yet, load it on-demand
          if (!pool) {
            console.log(`  📥 Pool not loaded, loading on-demand: ${dbPos.pool_address.slice(-8)}`);
            try {
              const { Pool } = await import('./Pool.js');
              pool = new Pool(
                dbPos.pool_address,
                dbPos.token_a,
                dbPos.token_b,
                this.opsClient,
                this.repository
              );

              // Load pool state from blockchain
              await pool.loadState();

              // Store in manager for future use
              const pairKey = getPairKey(dbPos.token_a, dbPos.token_b);
              this.pools.set(pairKey, pool);

              console.log(`  ✅ Pool loaded: ${dbPos.pool_address.slice(-8)}`);
            } catch (loadError) {
              console.error(`  ❌ Failed to load pool ${dbPos.pool_address.slice(-8)}:`, loadError.message);
              continue;
            }
          }

          const shares = BigInt(dbPos.shares);

          if (shares <= 0n) {
            continue;
          }

          console.log(`  Pool ${pool.poolAddress.slice(-8)}: User has ${shares} shares`);

          const symbolA = await pool.getTokenSymbol(pool.tokenA);
          const symbolB = await pool.getTokenSymbol(pool.tokenB);

          // Calculate totalShares from database (sum all LP positions for this pool)
          // This is necessary because pool.totalShares may be 0 if loaded on-demand
          const allPoolPositions = await this.repository.getLPPositions(dbPos.pool_address);
          const totalShares = allPoolPositions.reduce(
            (sum, pos) => sum + BigInt(pos.shares),
            0n
          );

          console.log(`  Total shares in pool: ${totalShares} (calculated from ${allPoolPositions.length} positions)`);

          // Calculate share percentage
          const sharePercent = totalShares > 0n
            ? Number((shares * 10000n) / totalShares) / 100
            : 0;

          // Calculate amounts from shares and current reserves (dynamic calculation)
          const { calculateAmountsForLPBurn } = await import('../utils/math.js');
          const { amountA, amountB } = calculateAmountsForLPBurn(
            shares,
            totalShares,
            pool.reserveA,
            pool.reserveB
          );

          // Use cached decimals from pool object (fetched during pool initialization)
          const decimalsA = pool.decimalsA;
          const decimalsB = pool.decimalsB;

          // Format amounts removing trailing zeros for better display
          const amountANum = Number(amountA) / Math.pow(10, decimalsA);
          const amountBNum = Number(amountB) / Math.pow(10, decimalsB);

          // Use toFixed for precision, then parseFloat to remove trailing zeros
          const amountAFormatted = parseFloat(amountANum.toFixed(Math.min(decimalsA, 6))).toString();
          const amountBFormatted = parseFloat(amountBNum.toFixed(Math.min(decimalsB, 6))).toString();

          positions.push({
            poolAddress: pool.poolAddress,
            tokenA: pool.tokenA,
            tokenB: pool.tokenB,
            symbolA,
            symbolB,
            liquidity: shares.toString(),
            sharePercent,
            amountA: amountAFormatted,
            amountB: amountBFormatted,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error(`Error processing position for pool ${dbPos.pool_address}:`, error.message);
          // Continue to next position instead of failing completely
        }
      }
    } catch (error) {
      console.error(`Error querying user positions from database:`, error.message);
      // Return empty array on database error
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
