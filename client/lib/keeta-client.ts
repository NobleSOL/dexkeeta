// Client-side Keeta blockchain utilities
// Fetches data directly from Keeta network without backend

import * as KeetaSDK from '@keetanetwork/keetanet-client';

const KEETA_NODE = 'https://api.test.keeta.com';
const KEETA_NETWORK = 'test';

/**
 * Create a UserClient for read-only operations (no signing)
 */
export function createKeetaClient() {
  return KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK as any, null);
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
  try {
    console.log('🔧 Creating client from seed...');
    const seedBytes = hexToBytes(seed);
    console.log('✅ Seed bytes created:', seedBytes.length, 'bytes');

    // Try to access Account class
    if (!KeetaSDK.lib || !KeetaSDK.lib.Account) {
      console.error('❌ KeetaSDK.lib.Account not available!');
      console.log('Available in KeetaSDK:', Object.keys(KeetaSDK).slice(0, 20));
      if (KeetaSDK.lib) {
        console.log('Available in KeetaSDK.lib:', Object.keys(KeetaSDK.lib));
      }
      throw new Error('Account class not available in SDK');
    }

    console.log('✅ Account class found');
    const account = KeetaSDK.lib.Account.fromSeed(seedBytes, accountIndex);
    console.log('✅ Account created');

    return KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK as any, account);
  } catch (error) {
    console.error('❌ Error in createKeetaClientFromSeed:', error);
    throw error;
  }
}

/**
 * Get account address from seed
 */
export function getAddressFromSeed(seed: string, accountIndex: number = 0): string {
  try {
    console.log('🔧 Getting address from seed...');
    const seedBytes = hexToBytes(seed);

    if (!KeetaSDK.lib || !KeetaSDK.lib.Account) {
      throw new Error('Account class not available in SDK');
    }

    const account = KeetaSDK.lib.Account.fromSeed(seedBytes, accountIndex);
    return account.publicKeyString.get();
  } catch (error) {
    console.error('❌ Error in getAddressFromSeed:', error);
    throw error;
  }
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
 * Fetch token balances for an address using a seed
 * Note: This requires the seed to create a UserClient instance
 */
export async function fetchBalances(seed: string, accountIndex: number = 0) {
  try {
    console.log('🔍 fetchBalances called');
    const client = createKeetaClientFromSeed(seed, accountIndex);
    console.log('✅ Client created with account');
    const balances = await client.allBalances();
    console.log('✅ Raw balances from blockchain:', balances);
    console.log('📊 Balance structure:', balances.length > 0 ? Object.keys(balances[0]) : 'empty');

    // Handle case where balances might be in a different format
    let balanceArray = balances;
    if (!Array.isArray(balances)) {
      console.log('⚠️ Balances is not an array, checking for data property...');
      if (balances.balances && Array.isArray(balances.balances)) {
        balanceArray = balances.balances;
      } else {
        console.error('❌ Cannot extract balance array from response');
        return [];
      }
    }

    // Format balances with metadata
    const formattedBalances = await Promise.all(
      balanceArray.map(async (b: any) => {
        try {
          console.log('🔍 Processing balance item:', b);

          // Extract token address (might be different property names)
          const tokenAddress = b.token || b.account || b.address;
          const balanceValue = b.balance || b.amount || b.value || '0';

          console.log('  Token:', tokenAddress);
          console.log('  Balance:', balanceValue);

          const metadata = await fetchTokenMetadata(tokenAddress);
          const rawBalance = Number(balanceValue) || 0;
          const decimals = metadata.decimals || 9;
          const balanceFormatted = rawBalance / (10 ** decimals);

          return {
            address: tokenAddress,
            symbol: metadata.symbol || 'UNKNOWN',
            balance: balanceValue?.toString() || '0',
            balanceFormatted: isNaN(balanceFormatted) ? '0.000000000' : balanceFormatted.toFixed(decimals),
            decimals
          };
        } catch (err) {
          console.error('Error formatting balance:', err);
          return {
            address: b.token || b.account || 'unknown',
            symbol: 'ERROR',
            balance: '0',
            balanceFormatted: '0.000000000',
            decimals: 9
          };
        }
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
 * Fetch available pools (from API with on-chain data already included)
 * Pool reserves need to be fetched server-side since we can't query arbitrary addresses client-side
 */
export async function fetchPools() {
  try {
    // Fetch pool list from API (with reserves already included)
    const response = await fetch(`${window.location.origin}/api/pools`);
    if (!response.ok) throw new Error('Failed to fetch pools');

    const data = await response.json();
    const poolList = data.pools || [];

    // Return pools as-is since server should enrich them
    return poolList;
  } catch (error) {
    console.error('Error fetching pools:', error);
    return [];
  }
}
