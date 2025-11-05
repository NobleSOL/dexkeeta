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

    // Create account from seed
    const seedBytes = hexToBytes(seed);
    const account = KeetaSDK.lib.Account.fromSeed(seedBytes, accountIndex);
    const address = account.publicKeyString.get();
    console.log('✅ Account created:', address);

    // Create client
    const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK as any, account);
    console.log('✅ Client created');

    // Fetch balances - pass account object as parameter
    const rawBalances = await client.allBalances({ account });
    console.log('✅ Raw balances from blockchain:', rawBalances);

    // Format balances with metadata
    const formattedBalances = await Promise.all(
      rawBalances.map(async (b: any) => {
        try {
          // Extract token address from Account object
          const tokenAddress = b.token.publicKeyString?.toString() ?? b.token.toString();
          const balanceValue = BigInt(b.balance ?? 0n);

          console.log(`  Token: ${tokenAddress}, Balance: ${balanceValue}`);

          const metadata = await fetchTokenMetadata(tokenAddress);
          const rawBalance = Number(balanceValue);
          const decimals = metadata.decimals || 9;
          const balanceFormatted = rawBalance / (10 ** decimals);

          return {
            address: tokenAddress,
            symbol: metadata.symbol,
            balance: balanceValue.toString(),
            balanceFormatted: balanceFormatted.toFixed(decimals),
            decimals
          };
        } catch (err) {
          console.error('Error formatting balance:', err);
          return {
            address: 'unknown',
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
 * Uses the same pattern as server-side code
 */
export async function fetchTokenMetadata(tokenAddress: string) {
  // Check known tokens first (hardcoded fallback)
  const knownTokens: Record<string, { symbol: string; decimals: number }> = {
    'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52': { symbol: 'KTA', decimals: 9 },
    'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym': { symbol: 'WAVE', decimals: 9 },
    'keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo': { symbol: 'RIDE', decimals: 9 },
  };

  const known = knownTokens[tokenAddress];
  if (known) {
    return known;
  }

  try {
    const client = createKeetaClient();

    console.log(`🔍 Fetching metadata for: ${tokenAddress}`);

    // Use getAccountsInfo (plural) which takes an array
    const accountsInfo = await client.getAccountsInfo([tokenAddress]);
    console.log(`📊 Raw accountsInfo response:`, accountsInfo);

    const info = accountsInfo[tokenAddress];
    console.log(`📊 Info for ${tokenAddress.slice(0, 20)}...:`, info);

    if (info?.info) {
      // Get symbol from info.name (Keeta stores token symbol here)
      const symbol = info.info.name || tokenAddress.slice(0, 8) + '...';
      console.log(`  Symbol from info.name: ${symbol}`);

      // Get decimals from metadata object
      let decimals = 9; // Default
      if (info.info.metadata) {
        try {
          // Metadata is base64 encoded
          const metadataStr = atob(info.info.metadata);
          const metaObj = JSON.parse(metadataStr);
          console.log(`  Parsed metadata:`, metaObj);
          decimals = Number(metaObj.decimalPlaces || metaObj.decimals || 9);
        } catch (parseErr) {
          console.warn(`Could not parse metadata for ${tokenAddress.slice(0, 12)}...`);
        }
      }

      console.log(`✅ Final metadata: ${symbol}, ${decimals} decimals`);
      return { symbol, decimals };
    }
  } catch (error) {
    console.warn(`Could not fetch metadata for ${tokenAddress.slice(0, 12)}...:`, error);
  }

  // Default values if metadata not found
  return {
    symbol: tokenAddress.slice(0, 8) + '...',
    decimals: 9
  };
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

/**
 * Fetch user's liquidity positions from blockchain
 * This queries the user's token balances and identifies LP tokens for known pools
 */
export async function fetchLiquidityPositions(seed: string, accountIndex: number = 0) {
  try {
    console.log('🔍 Fetching liquidity positions...');

    // Get all user balances
    const balances = await fetchBalances(seed, accountIndex);
    console.log('✅ User balances:', balances);

    // Get list of known pools
    const pools = await fetchPools();
    console.log('✅ Known pools:', pools);

    // For each pool, check if user has LP tokens (liquidity in the pool)
    const positions = [];

    for (const pool of pools) {
      // Check if user has any balance in the pool address itself
      // In Keeta's user-owned pool model, users hold their liquidity in the pool storage account
      const poolBalance = balances.find(b => b.address === pool.poolAddress);

      if (poolBalance && Number(poolBalance.balance) > 0) {
        // User has liquidity in this pool
        positions.push({
          poolAddress: pool.poolAddress,
          tokenA: pool.tokenA,
          tokenB: pool.tokenB,
          symbolA: pool.symbolA,
          symbolB: pool.symbolB,
          liquidity: poolBalance.balance,
          sharePercent: 0, // TODO: Calculate share percentage
          amountA: '0', // TODO: Calculate underlying token amounts
          amountB: '0',
          timestamp: Date.now()
        });
      }
    }

    console.log('✅ Found positions:', positions);
    return positions;
  } catch (error) {
    console.error('Error fetching liquidity positions:', error);
    return [];
  }
}
