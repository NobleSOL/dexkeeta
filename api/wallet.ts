// Vercel serverless function for Keeta wallet operations
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Dynamically import Keeta SDK (ESM module)
    const { lib } = await import('@keetanetwork/keetanet-client');

    const { action = 'generate', seed: providedSeed } = req.body;
    let seed: string;
    let address: string;

    if (action === 'generate') {
      // Generate a random 32-byte seed
      const randomSeed = randomBytes(32);
      seed = randomSeed.toString('hex');

      // Derive Keeta account from seed
      const account = lib.Account.fromSeed(Buffer.from(seed, 'hex'), 0);
      address = account.publicKeyString.get();

      return res.status(200).json({
        success: true,
        address,
        seed,
        tokens: [], // Balances fetched client-side after wallet creation
        message: 'Wallet generated successfully'
      });
    } else if (action === 'import') {
      // Validate seed is provided
      if (!providedSeed) {
        return res.status(400).json({
          success: false,
          error: 'Seed is required for import'
        });
      }

      // Validate seed format (64 hex characters)
      if (!/^[0-9a-fA-F]{64}$/.test(providedSeed)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid seed format. Must be 64 hex characters'
        });
      }

      seed = providedSeed;

      // Derive Keeta account from provided seed
      const account = lib.Account.fromSeed(Buffer.from(seed, 'hex'), 0);
      address = account.publicKeyString.get();

      return res.status(200).json({
        success: true,
        address,
        seed,
        tokens: [], // Balances fetched client-side after wallet import
        message: 'Wallet imported successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "generate" or "import"'
      });
    }
  } catch (error: any) {
    console.error('Wallet serverless function error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
