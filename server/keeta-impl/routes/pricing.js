// Pricing API for Keeta tokens
import express from 'express';
import { getPoolRepository } from '../db/pool-repository.js';

const router = express.Router();

// KTA token address
const KTA_ADDRESS = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';

/**
 * GET /api/pricing/tokens
 * Get USD prices for Keeta tokens
 *
 * Query params:
 *   - addresses: comma-separated list of token addresses
 *
 * Returns: { [address]: { priceUsd: number | null, change24h: number | null } }
 */
router.get('/tokens', async (req, res) => {
  try {
    const { addresses } = req.query;

    if (!addresses) {
      return res.status(400).json({
        success: false,
        error: 'Missing addresses parameter',
      });
    }

    const addressList = addresses.split(',').map(a => a.trim()).filter(Boolean);

    if (addressList.length === 0) {
      return res.json({ success: true, prices: {} });
    }

    const prices = await calculateTokenPrices(addressList);

    res.json({
      success: true,
      prices,
    });
  } catch (error) {
    console.error('Pricing error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Calculate prices for a list of token addresses
 * KTA price is hardcoded/fetched from external source
 * Other token prices are calculated based on pool ratios with KTA
 */
async function calculateTokenPrices(addresses) {
  const prices = {};

  // Get KTA price (hardcoded for now - TODO: fetch from price oracle when available)
  const ktaPrice = 0.15; // $0.15 per KTA (placeholder)

  const repository = getPoolRepository();
  const pools = await repository.getAllPools();

  for (const address of addresses) {
    if (address === KTA_ADDRESS) {
      // KTA has a known price
      prices[address] = {
        priceUsd: ktaPrice,
        change24h: null, // TODO: Calculate from historical data when available
      };
    } else {
      // Find a pool with this token and KTA
      const pool = pools.find(p =>
        (p.token_a === address && p.token_b === KTA_ADDRESS) ||
        (p.token_b === address && p.token_a === KTA_ADDRESS)
      );

      if (pool) {
        // Calculate price based on pool ratio
        const isTokenA = pool.token_a === address;
        const reserveToken = isTokenA ? BigInt(pool.reserve_a) : BigInt(pool.reserve_b);
        const reserveKTA = isTokenA ? BigInt(pool.reserve_b) : BigInt(pool.reserve_a);

        if (reserveToken > 0n && reserveKTA > 0n) {
          // Price of token = (reserveKTA / reserveToken) * ktaPrice
          // Using 9 decimals for both tokens
          const ratio = Number(reserveKTA) / Number(reserveToken);
          const tokenPrice = ratio * ktaPrice;

          prices[address] = {
            priceUsd: tokenPrice,
            change24h: null, // TODO: Calculate from snapshots
          };
        } else {
          prices[address] = {
            priceUsd: null,
            change24h: null,
          };
        }
      } else {
        // No pool found with KTA, can't calculate price
        prices[address] = {
          priceUsd: null,
          change24h: null,
        };
      }
    }
  }

  return prices;
}

export default router;
