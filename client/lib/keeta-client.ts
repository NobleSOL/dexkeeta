// Client-side Keeta blockchain utilities
// Fetches data directly from Keeta network without backend

import { UserClient, lib } from '@keetanetwork/keetanet-client';

const KEETA_NODE = 'https://api.test.keeta.com';
const KEETA_NETWORK = 'test';

/**
 * Create a UserClient for read-only operations (no signing)
 */
export function createKeetaClient() {
  return UserClient.fromNetwork(KEETA_NETWORK as any, null);
}

/**
 * Convert hex string to Uint8Array (browser-compatible)
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Create a UserClient from a seed for signing transactions
 */
export function createKeetaClientFromSeed(seed: string, accountIndex: number = 0) {
  const seedBytes = hexToBytes(seed);
  const account = lib.Account.fromSeed(seedBytes, accountIndex);
  return UserClient.fromNetwork(KEETA_NETWORK as any, account);
}

/**
 * Get account address from seed
 */
export function getAddressFromSeed(seed: string, accountIndex: number = 0): string {
  const seedBytes = hexToBytes(seed);
  const account = lib.Account.fromSeed(seedBytes, accountIndex);
  return account.publicKeyString.get();
}

/**
 * Generate a new wallet (client-side)
 */
export function generateWallet(): { seed: string; address: string } {
  const crypto = window.crypto || (window as any).msCrypto;
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  const seed = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const address = getAddressFromSeed(seed);

  return { seed, address };
}

/**
 * Fetch token balances for an address
 */
export async function fetchBalances(address: string) {
  try {
    const client = createKeetaClient();
    const balances = await client.getAllBalances({ account: address });

    // Format balances with metadata
    const formattedBalances = await Promise.all(
      balances.map(async (b: any) => {
        const metadata = await fetchTokenMetadata(b.token);
        const balanceFormatted = Number(b.balance) / (10 ** metadata.decimals);

        return {
          address: b.token,
          symbol: metadata.symbol,
          balance: b.balance.toString(),
          balanceFormatted: balanceFormatted.toFixed(metadata.decimals),
          decimals: metadata.decimals
        };
      })
    );

    return formattedBalances;
  } catch (error) {
    console.error('Error fetching balances:', error);
    return [];
  }
}

/**
 * Fetch token metadata (symbol, decimals)
 */
export async function fetchTokenMetadata(tokenAddress: string) {
  try {
    const client = createKeetaClient();
    const info = await client.getAccountInfo({ account: tokenAddress });

    let symbol = 'UNKNOWN';
    let decimals = 9;

    if (info?.data) {
      // Try to parse metadata from account data
      try {
        const dataStr = typeof info.data === 'string' ? info.data : JSON.stringify(info.data);

        // Extract symbol from various possible formats
        if (dataStr.includes('"symbol"')) {
          const symbolMatch = dataStr.match(/"symbol"\s*:\s*"([^"]+)"/);
          if (symbolMatch) symbol = symbolMatch[1];
        }

        // Extract decimals
        if (dataStr.includes('"decimals"')) {
          const decimalsMatch = dataStr.match(/"decimals"\s*:\s*(\d+)/);
          if (decimalsMatch) decimals = parseInt(decimalsMatch[1]);
        }
      } catch (e) {
        console.warn('Could not parse token metadata:', e);
      }
    }

    // Fallback: Check known tokens
    const knownTokens: Record<string, { symbol: string; decimals: number }> = {
      'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym': { symbol: 'KTA', decimals: 9 },
      'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52': { symbol: 'WAVE', decimals: 9 },
      'keeta_ant32bbs6vdcagr3lw4oxcl5vcf5gvrhm6qrdlmrwhzdljbtvb4psj7b3eapglm': { symbol: 'RIDE', decimals: 9 },
    };

    const known = knownTokens[tokenAddress];
    if (known) {
      symbol = known.symbol;
      decimals = known.decimals;
    }

    return { symbol, decimals };
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return { symbol: 'UNKNOWN', decimals: 9 };
  }
}

/**
 * Fetch available pools (from API first, then enrich with on-chain data)
 */
export async function fetchPools() {
  try {
    // Fetch pool list from API
    const response = await fetch(`${window.location.origin}/api/pools`);
    if (!response.ok) throw new Error('Failed to fetch pools');

    const data = await response.json();
    const poolList = data.pools || [];

    // Enrich each pool with on-chain reserve data
    const client = createKeetaClient();
    const enrichedPools = await Promise.all(
      poolList.map(async (pool: any) => {
        try {
          // Fetch reserves from pool account
          const balances = await client.getAllBalances({ account: pool.poolAddress });

          const reserveA = balances.find((b: any) => b.token === pool.tokenA)?.balance || '0';
          const reserveB = balances.find((b: any) => b.token === pool.tokenB)?.balance || '0';

          // Fetch metadata for formatting
          const metadataA = await fetchTokenMetadata(pool.tokenA);
          const metadataB = await fetchTokenMetadata(pool.tokenB);

          const reserveAHuman = Number(reserveA) / (10 ** metadataA.decimals);
          const reserveBHuman = Number(reserveB) / (10 ** metadataB.decimals);

          const price = reserveAHuman > 0 ? (reserveBHuman / reserveAHuman).toFixed(6) : '0';

          return {
            ...pool,
            reserveA: reserveA.toString(),
            reserveB: reserveB.toString(),
            reserveAHuman,
            reserveBHuman,
            price,
            totalShares: '0', // Not tracked yet
          };
        } catch (err) {
          console.error('Error enriching pool:', err);
          return pool;
        }
      })
    );

    return enrichedPools;
  } catch (error) {
    console.error('Error fetching pools:', error);
    return [];
  }
}
