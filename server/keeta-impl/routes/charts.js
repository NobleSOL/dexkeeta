// src/routes/charts.js
import express from 'express';
import { getPoolRepository } from '../db/pool-repository.js';
import { fromAtomic } from '../utils/constants.js';

const router = express.Router();

/**
 * GET /api/charts/price/:poolAddress
 * Get price history for a pool from snapshots
 *
 * Query params:
 *   - limit: number of data points (default 100)
 */
router.get('/price/:poolAddress', async (req, res) => {
  try {
    const { poolAddress } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    if (!poolAddress) {
      return res.status(400).json({
        error: 'Missing pool address',
      });
    }

    const poolRepo = getPoolRepository();

    // Get pool info to know the tokens
    const pool = await poolRepo.getPoolByAddress(poolAddress);
    if (!pool) {
      // Return empty data instead of 404 if pool not found in database
      // The pool might exist on-chain but not in the database yet
      return res.json({
        success: true,
        data: [],
        message: 'No snapshot data available for this pool yet',
      });
    }

    // Get snapshots (ordered DESC, so we'll reverse them)
    const snapshots = await poolRepo.getPoolSnapshots(poolAddress, limit);

    if (!snapshots || snapshots.length === 0) {
      return res.json({
        success: true,
        data: [],
        poolInfo: {
          tokenA: pool.token_a,
          tokenB: pool.token_b,
        },
      });
    }

    // Transform snapshots into price data
    // Price = reserveB / reserveA (token B per token A)
    // Reverse to get chronological order (oldest first)
    const priceData = snapshots
      .reverse()
      .map((snapshot) => {
        const reserveA = BigInt(snapshot.reserve_a);
        const reserveB = BigInt(snapshot.reserve_b);

        // Avoid division by zero
        if (reserveA === 0n) {
          return null;
        }

        // Calculate price with precision
        // Price = (reserveB * 1e18) / reserveA / 1e18
        const price = Number(reserveB * 1000000000n / reserveA) / 1000000000;

        return {
          time: Math.floor(new Date(snapshot.snapshot_time).getTime() / 1000),
          value: price,
        };
      })
      .filter(Boolean); // Remove null values

    res.json({
      success: true,
      data: priceData,
      poolInfo: {
        tokenA: pool.token_a,
        tokenB: pool.token_b,
      },
    });
  } catch (error) {
    console.error('Chart data error:', error);
    // Return empty data instead of 500 error when database is unavailable
    // This allows the UI to gracefully handle missing chart data
    res.json({
      success: true,
      data: [],
      message: 'Chart data temporarily unavailable',
    });
  }
});

export default router;
