// server/keeta-impl/db/pool-repository.js
import { getDbPool } from './client.js';
import { getPairKey } from '../utils/constants.js';

/**
 * Repository for pool database operations
 */
export class PoolRepository {
  /**
   * Save pool to database
   */
  async savePool(poolData) {
    const pool = getDbPool();
    const { poolAddress, tokenA, tokenB, lpTokenAddress, creator } = poolData;
    const pairKey = getPairKey(tokenA, tokenB);

    const query = `
      INSERT INTO pools (pool_address, token_a, token_b, lp_token_address, creator, pair_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (pool_address)
      DO UPDATE SET
        lp_token_address = EXCLUDED.lp_token_address,
        creator = EXCLUDED.creator,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [poolAddress, tokenA, tokenB, lpTokenAddress, creator, pairKey];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Load all pools from database
   */
  async loadPools() {
    const pool = getDbPool();
    const query = 'SELECT * FROM pools ORDER BY created_at ASC;';
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get pool by pair key
   */
  async getPoolByPairKey(tokenA, tokenB) {
    const pool = getDbPool();
    const pairKey = getPairKey(tokenA, tokenB);
    const query = 'SELECT * FROM pools WHERE pair_key = $1;';
    const result = await pool.query(query, [pairKey]);
    return result.rows[0] || null;
  }

  /**
   * Get pool by address
   */
  async getPoolByAddress(poolAddress) {
    const pool = getDbPool();
    const query = 'SELECT * FROM pools WHERE pool_address = $1;';
    const result = await pool.query(query, [poolAddress]);
    return result.rows[0] || null;
  }

  /**
   * Delete pool (if needed)
   */
  async deletePool(poolAddress) {
    const pool = getDbPool();
    const query = 'DELETE FROM pools WHERE pool_address = $1;';
    await pool.query(query, [poolAddress]);
  }

  /**
   * Save LP position
   */
  async saveLPPosition(poolAddress, userAddress, shares) {
    const pool = getDbPool();
    const query = `
      INSERT INTO lp_positions (pool_address, user_address, shares)
      VALUES ($1, $2, $3)
      ON CONFLICT (pool_address, user_address)
      DO UPDATE SET
        shares = EXCLUDED.shares,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [poolAddress, userAddress, shares.toString()];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get LP positions for a pool
   */
  async getLPPositions(poolAddress) {
    const pool = getDbPool();
    const query = 'SELECT * FROM lp_positions WHERE pool_address = $1 AND shares > 0;';
    const result = await pool.query(query, [poolAddress]);
    return result.rows;
  }

  /**
   * Get user's LP positions across all pools
   */
  async getUserPositions(userAddress) {
    const pool = getDbPool();
    const query = `
      SELECT lp.*, p.token_a, p.token_b, p.pool_address
      FROM lp_positions lp
      JOIN pools p ON lp.pool_address = p.pool_address
      WHERE lp.user_address = $1 AND lp.shares > 0;
    `;
    const result = await pool.query(query, [userAddress]);
    return result.rows;
  }

  /**
   * Delete LP position (when shares = 0)
   */
  async deleteLPPosition(poolAddress, userAddress) {
    const pool = getDbPool();
    const query = 'DELETE FROM lp_positions WHERE pool_address = $1 AND user_address = $2;';
    await pool.query(query, [poolAddress, userAddress]);
  }

  /**
   * Update pool with LP token address (for migration)
   */
  async updatePoolLPToken(poolAddress, lpTokenAddress) {
    const pool = getDbPool();
    const query = `
      UPDATE pools
      SET lp_token_address = $1, updated_at = CURRENT_TIMESTAMP
      WHERE pool_address = $2
      RETURNING *;
    `;
    const result = await pool.query(query, [lpTokenAddress, poolAddress]);
    return result.rows[0];
  }
}
