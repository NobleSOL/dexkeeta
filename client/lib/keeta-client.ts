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
 * Fetch pool reserves directly from blockchain
 * Queries the pool account's token balances
 */
async function fetchPoolReserves(poolAddress: string, tokenA: string, tokenB: string) {
  try {
    // Create a temporary account from the pool address to query its balances
    const client = createKeetaClient();
    const poolAccount = KeetaSDK.lib.Account.fromPublicKeyString(poolAddress);

    // Query balances for the pool account
    const rawBalances = await client.allBalances({ account: poolAccount });

    // Extract token balances
    let reserveA = 0n;
    let reserveB = 0n;

    for (const b of rawBalances) {
      const tokenAddr = b.token.publicKeyString?.toString() ?? b.token.toString();
      const balance = BigInt(b.balance ?? 0n);

      if (tokenAddr === tokenA) {
        reserveA = balance;
      } else if (tokenAddr === tokenB) {
        reserveB = balance;
      }
    }

    return { reserveA, reserveB };
  } catch (error) {
    console.warn(`Could not fetch reserves for pool ${poolAddress}:`, error);
    return { reserveA: 0n, reserveB: 0n };
  }
}

/**
 * Fetch available pools with live reserves from blockchain
 * Uses hardcoded pool list + fetches reserves directly from chain
 */
export async function fetchPools() {
  try {
    // Hardcoded known pools (pool addresses are deterministic)
    const knownPools = [
      {
        poolAddress: 'keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek',
        tokenA: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52', // KTA
        tokenB: 'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym', // WAVE
        symbolA: 'KTA',
        symbolB: 'WAVE',
        decimalsA: 9,
        decimalsB: 9,
      },
      // Add more pools here as they're created
    ];

    // Fetch reserves for each pool from blockchain
    const poolsWithReserves = await Promise.all(
      knownPools.map(async (pool) => {
        const { reserveA, reserveB } = await fetchPoolReserves(
          pool.poolAddress,
          pool.tokenA,
          pool.tokenB
        );

        const reserveAHuman = Number(reserveA) / (10 ** pool.decimalsA);
        const reserveBHuman = Number(reserveB) / (10 ** pool.decimalsB);

        return {
          ...pool,
          reserveA: reserveA.toString(),
          reserveB: reserveB.toString(),
          reserveAHuman,
          reserveBHuman,
          totalShares: '0', // TODO: Track total shares
          priceAtoB: reserveAHuman > 0 ? reserveBHuman / reserveAHuman : 0,
          priceBtoA: reserveBHuman > 0 ? reserveAHuman / reserveBHuman : 0,
        };
      })
    );

    return poolsWithReserves;
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

/**
 * Calculate swap output amount using constant product formula (x * y = k)
 * Includes 0.3% swap fee
 */
function calculateSwapOutput(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): { amountOut: bigint; priceImpact: number } {
  if (reserveIn === 0n || reserveOut === 0n) {
    return { amountOut: 0n, priceImpact: 0 };
  }

  // Apply 0.3% fee (multiply by 997, divide by 1000)
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000n) + amountInWithFee;
  const amountOut = numerator / denominator;

  // Calculate price impact
  const exactQuote = (amountIn * reserveOut) / reserveIn;
  const priceImpact = exactQuote > 0n 
    ? Number((exactQuote - amountOut) * 10000n / exactQuote) / 100
    : 0;

  return { amountOut, priceImpact };
}

/**
 * Get swap quote for a token pair
 */
export async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  poolAddress: string
): Promise<{
  amountOut: string;
  amountOutHuman: number;
  priceImpact: number;
  minimumReceived: string;
  feeAmount: string;
  feeAmountHuman: number;
} | null> {
  try {
    // Fetch pool reserves
    const pools = await fetchPools();
    const pool = pools.find(p => p.poolAddress === poolAddress);

    if (!pool) {
      console.error('Pool not found:', poolAddress);
      return null;
    }

    // Determine which token is A and which is B
    const isAtoB = tokenIn === pool.tokenA;
    const reserveIn = isAtoB ? BigInt(pool.reserveA) : BigInt(pool.reserveB);
    const reserveOut = isAtoB ? BigInt(pool.reserveB) : BigInt(pool.reserveA);
    const decimalsIn = isAtoB ? pool.decimalsA : pool.decimalsB;
    const decimalsOut = isAtoB ? pool.decimalsB : pool.decimalsA;

    // Convert amountIn to atomic units
    const amountInAtomic = BigInt(Math.floor(parseFloat(amountIn) * 1e9));

    // Calculate fee (0.3% = 30 bps)
    const feeAmount = (amountInAtomic * 30n) / 10000n;
    const feeAmountHuman = Number(feeAmount) / (10 ** decimalsIn);

    // Calculate output
    const { amountOut, priceImpact } = calculateSwapOutput(
      amountInAtomic,
      reserveIn,
      reserveOut
    );

    // Apply 0.5% slippage tolerance
    const minimumReceived = (amountOut * 995n) / 1000n;

    return {
      amountOut: amountOut.toString(),
      amountOutHuman: Number(amountOut) / (10 ** decimalsOut),
      priceImpact,
      minimumReceived: minimumReceived.toString(),
      feeAmount: feeAmount.toString(),
      feeAmountHuman,
    };
  } catch (error) {
    console.error('Error calculating swap quote:', error);
    return null;
  }
}

/**
 * Execute a swap transaction
 */
export async function executeSwap(
  seed: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  minAmountOut: string,
  poolAddress: string,
  accountIndex: number = 0
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    console.log('🔄 Executing swap...');
    console.log('  tokenIn:', tokenIn);
    console.log('  tokenOut:', tokenOut);
    console.log('  amountIn:', amountIn);
    console.log('  minAmountOut:', minAmountOut);
    console.log('  poolAddress:', poolAddress);

    // Create client from seed
    const client = createKeetaClientFromSeed(seed, accountIndex);
    const seedBytes = hexToBytes(seed);
    const account = KeetaSDK.lib.Account.fromSeed(seedBytes, accountIndex);
    const userAddress = account.publicKeyString.get();

    console.log('  userAddress:', userAddress);

    // Convert amounts to atomic units (BigInt)
    const amountInAtomic = BigInt(Math.floor(parseFloat(amountIn) * 1e9));
    const minAmountOutAtomic = BigInt(Math.floor(parseFloat(minAmountOut) * 1e9));

    // Fetch pool reserves to calculate swap output
    const quote = await getSwapQuote(tokenIn, tokenOut, amountIn, poolAddress);
    if (!quote) {
      throw new Error('Failed to get swap quote');
    }

    const amountOut = BigInt(quote.amountOut);

    // Check slippage
    if (amountOut < minAmountOutAtomic) {
      throw new Error(`Slippage too high: expected min ${minAmountOutAtomic}, got ${amountOut}`);
    }

    // Calculate fee (0.3% = 30 bps)
    const feeAmount = (amountInAtomic * 30n) / 10000n;
    const amountInAfterFee = amountInAtomic - feeAmount;

    console.log('  amountInAtomic:', amountInAtomic.toString());
    console.log('  amountOut:', amountOut.toString());
    console.log('  feeAmount:', feeAmount.toString());

    // Build transaction
    const builder = client.initBuilder();

    const tokenInAccount = KeetaSDK.lib.Account.fromPublicKeyString(tokenIn);
    const tokenOutAccount = KeetaSDK.lib.Account.fromPublicKeyString(tokenOut);
    const poolAccount = KeetaSDK.lib.Account.fromPublicKeyString(poolAddress);
    const userAccount = KeetaSDK.lib.Account.fromPublicKeyString(userAddress);

    // Treasury address
    const TREASURY_ADDRESS = 'keeta_aabtozgfunwwvwdztv54y6l5x57q2g3254shgp27zjltr2xz3pyo7q4tjtmsamy';
    const treasuryAccount = KeetaSDK.lib.Account.fromPublicKeyString(TREASURY_ADDRESS);

    // 1. User sends fee to treasury
    if (feeAmount > 0n) {
      builder.send(treasuryAccount, feeAmount, tokenInAccount);
      console.log('  ✅ Added: User sends fee to treasury');
    }

    // 2. User sends input token to pool
    builder.send(poolAccount, amountInAfterFee, tokenInAccount);
    console.log('  ✅ Added: User sends input to pool');

    // 3. Pool sends output token to user (this requires SEND_ON_BEHALF permission which pool has)
    // Note: In browser, we can't use SEND_ON_BEHALF since we don't have pool's private key
    // This transaction will fail unless the pool account grants SEND_ON_BEHALF to user
    // For now, we'll build the transaction and let it fail gracefully
    builder.send(userAccount, amountOut, tokenOutAccount, undefined, {
      account: poolAccount,
    });
    console.log('  ✅ Added: Pool sends output to user');

    // Publish transaction
    console.log('📤 Publishing transaction...');
    const result = await client.publishBuilder(builder);
    console.log('✅ Transaction published:', result);

    return {
      success: true,
      txHash: result?.toString() || 'unknown',
    };
  } catch (error: any) {
    console.error('❌ Swap execution error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}
