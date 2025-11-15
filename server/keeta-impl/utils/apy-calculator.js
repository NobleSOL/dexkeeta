// server/keeta-impl/utils/apy-calculator.js
import { PoolRepository } from '../db/pool-repository.js';

/**
 * Calculate pool APY based on 24h reserve growth
 *
 * Logic:
 * - LP fees (0.25% of swaps) accumulate in pool reserves
 * - Compare current reserves to 24h ago snapshot
 * - Derive trading volume from reserve growth
 * - Calculate APY from fee earnings vs TVL
 */
export class APYCalculator {
  constructor() {
    this.repository = new PoolRepository();
  }

  /**
   * Calculate APY for a single pool
   * @param {string} poolAddress - Pool address
   * @param {bigint} currentReserveA - Current reserve A
   * @param {bigint} currentReserveB - Current reserve B
   * @param {number} decimalsA - Token A decimals
   * @param {number} decimalsB - Token B decimals
   * @returns {Promise<{ apy: number, volume24h: number, tvl: number }>}
   */
  async calculatePoolAPY(poolAddress, currentReserveA, currentReserveB, decimalsA, decimalsB) {
    try {
      // Get snapshot from 24 hours ago
      const snapshot24h = await this.repository.getSnapshotAt(poolAddress, 24);

      if (!snapshot24h) {
        // No snapshot available yet - return 0
        return {
          apy: 0,
          volume24h: 0,
          tvl: this.calculateTVL(currentReserveA, currentReserveB, decimalsA, decimalsB),
          reason: 'No 24h snapshot available yet',
        };
      }

      // Parse snapshot reserves (stored as strings in database)
      const oldReserveA = BigInt(snapshot24h.reserve_a);
      const oldReserveB = BigInt(snapshot24h.reserve_b);

      // Calculate reserve growth (in token A terms)
      const reserveAGrowth = currentReserveA > oldReserveA
        ? currentReserveA - oldReserveA
        : 0n;

      // If no growth, APY is 0
      if (reserveAGrowth === 0n) {
        return {
          apy: 0,
          volume24h: 0,
          tvl: this.calculateTVL(currentReserveA, currentReserveB, decimalsA, decimalsB),
          reason: 'No reserve growth in 24h',
        };
      }

      // Derive trading volume from reserve growth
      // LP fee is 0.25% (25 basis points), so: volume ≈ growth / 0.0025
      const volume24h = Number(reserveAGrowth) / Math.pow(10, decimalsA) / 0.0025;

      // Calculate TVL (Total Value Locked) in token A terms
      const tvl = this.calculateTVL(currentReserveA, currentReserveB, decimalsA, decimalsB);

      // Calculate APY
      // Total fees = volume × 0.3% (0.25% LP + 0.05% protocol, but LPs only get 0.25%)
      // Actually, the 0.25% already stayed in reserves, so we use total fee 0.3%
      // APY = (daily_fees × 365) / TVL × 100
      // But since growth already reflects the 0.25% that stayed, we need to extrapolate total volume
      // Total volume = growth / 0.0025
      // Total fees to LPs = volume × 0.0025 (this is what we already have as growth!)
      // Annual fees = daily_fees × 365
      const dailyFees = Number(reserveAGrowth) / Math.pow(10, decimalsA);
      const annualFees = dailyFees * 365;
      const apy = tvl > 0 ? (annualFees / tvl) * 100 : 0;

      return {
        apy: parseFloat(apy.toFixed(2)),
        volume24h: parseFloat(volume24h.toFixed(2)),
        tvl: parseFloat(tvl.toFixed(2)),
        snapshot_time: snapshot24h.snapshot_time,
      };
    } catch (error) {
      console.error(`Error calculating APY for pool ${poolAddress.slice(-8)}:`, error.message);
      return {
        apy: 0,
        volume24h: 0,
        tvl: this.calculateTVL(currentReserveA, currentReserveB, decimalsA, decimalsB),
        error: error.message,
      };
    }
  }

  /**
   * Calculate TVL (Total Value Locked) in token A terms
   * Simple calculation: reserve A × 2
   *
   * For more accurate TVL in USD, would need token prices
   */
  calculateTVL(reserveA, reserveB, decimalsA, decimalsB) {
    const reserveANum = Number(reserveA) / Math.pow(10, decimalsA);
    const reserveBNum = Number(reserveB) / Math.pow(10, decimalsB);

    // For now, just return reserves in token A terms (doubled to represent both sides)
    // In a real implementation, you'd convert to USD using price feeds
    return reserveANum * 2;
  }

  /**
   * Calculate APY for all pools
   * @param {Array<Object>} pools - Array of pool objects with reserves and decimals
   * @returns {Promise<Map<string, Object>>} - Map of pool address to APY data
   */
  async calculateAllPoolsAPY(pools) {
    const apyData = new Map();

    for (const pool of pools) {
      const apy = await this.calculatePoolAPY(
        pool.poolAddress,
        pool.reserveA,
        pool.reserveB,
        pool.decimalsA,
        pool.decimalsB
      );

      apyData.set(pool.poolAddress, apy);
    }

    return apyData;
  }
}

/**
 * Standalone function to calculate pool APY
 */
export async function calculatePoolAPY(poolAddress, currentReserveA, currentReserveB, decimalsA, decimalsB) {
  const calculator = new APYCalculator();
  return await calculator.calculatePoolAPY(poolAddress, currentReserveA, currentReserveB, decimalsA, decimalsB);
}
