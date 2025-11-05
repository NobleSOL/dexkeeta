// Vercel serverless function for fetching Keeta pools
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For now, return the hardcoded pool data
    // In the future, this could query on-chain pool registry
    const pools = [
      {
        poolAddress: 'keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek',
        tokenA: 'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym',
        tokenB: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
        symbolA: 'KTA',
        symbolB: 'WAVE',
      }
    ];

    return res.status(200).json({
      success: true,
      pools,
    });
  } catch (error: any) {
    console.error('Pools serverless function error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
