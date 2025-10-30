// src/utils/client.js
import * as KeetaNet from '@keetanetwork/keetanet-client';
import { CONFIG, seedFromHexEnv, cacheDecimals, getCachedDecimals } from './constants.js';

let opsClient = null;
let treasuryAccount = null;
let opsAccount = null;

/**
 * Initialize and return a singleton UserClient for operations
 */
export async function getOpsClient() {
  if (!opsClient) {
    const opsSeed = seedFromHexEnv('OPS_SEED');
    opsAccount = KeetaNet.lib.Account.fromSeed(opsSeed, 0);
    opsClient = KeetaNet.UserClient.fromNetwork(CONFIG.NETWORK, opsAccount);
    console.log('✅ Ops client initialized:', opsAccount.publicKeyString.get());
  }
  return opsClient;
}

/**
 * Validate a hex seed string
 * @param {string} seedHex - Seed to validate
 * @returns {boolean}
 */
function validateHexSeed(seedHex) {
  if (!seedHex || typeof seedHex !== 'string') return false;
  const trimmed = seedHex.trim();
  return /^[0-9A-Fa-f]{64}$/.test(trimmed);
}

/**
 * Create a UserClient from a user's seed (for permissionless operations)
 * @param {string} seedHex - User's seed as hex string
 * @param {number} accountIndex - Account index (default 0)
 * @returns {Object} { client: UserClient, account: Account, address: string }
 */
export function createUserClient(seedHex, accountIndex = 0) {
  if (!validateHexSeed(seedHex)) {
    throw new Error('Invalid seed: must be 64 hex characters');
  }

  const seed = Buffer.from(seedHex.trim(), 'hex');
  const account = KeetaNet.lib.Account.fromSeed(seed, accountIndex);
  const client = KeetaNet.UserClient.fromNetwork(CONFIG.NETWORK, account);
  const address = account.publicKeyString.get();

  console.log(`✅ User client created: ${address}`);

  return { client, account, address };
}

/**
 * Get the treasury account (for fee collection)
 */
export function getTreasuryAccount() {
  if (!treasuryAccount) {
    const treasurySeed = seedFromHexEnv('TREASURY_SEED');
    treasuryAccount = KeetaNet.lib.Account.fromSeed(treasurySeed, 0);
    console.log('✅ Treasury account loaded:', treasuryAccount.publicKeyString.get());
  }
  return treasuryAccount;
}

/**
 * Get the ops account
 */
export function getOpsAccount() {
  if (!opsAccount) {
    const opsSeed = seedFromHexEnv('OPS_SEED');
    opsAccount = KeetaNet.lib.Account.fromSeed(opsSeed, 0);
  }
  return opsAccount;
}

/**
 * Fetch token metadata from on-chain (symbol/ticker and decimals)
 * @param {string} tokenAddress - Token address
 * @returns {Promise<{symbol: string, decimals: number}>}
 */
export async function fetchTokenMetadata(tokenAddress) {
  // Check decimals cache first
  const cachedDecimals = getCachedDecimals(tokenAddress);

  try {
    const client = await getOpsClient();

    // Use getAccountsInfo (plural) which takes an array of accounts
    const accountsInfo = await client.client.getAccountsInfo([tokenAddress]);
    const info = accountsInfo[tokenAddress];

    if (info?.info) {
      // Get symbol from info.name (this is where Keeta stores the token symbol)
      const symbol = info.info.name || tokenAddress.slice(0, 8) + '...';

      // Get decimals from metadata object
      let decimals = 9; // Default
      if (info.info.metadata) {
        try {
          const metaObj = JSON.parse(
            Buffer.from(info.info.metadata, 'base64').toString()
          );
          decimals = Number(metaObj.decimalPlaces || metaObj.decimals || 9);
        } catch (parseErr) {
          console.warn(`⚠️ Could not parse metadata for ${tokenAddress.slice(0, 12)}...`);
        }
      }

      // Cache decimals
      cacheDecimals(tokenAddress, decimals);

      console.log(`✅ Fetched metadata for ${symbol}: ${decimals} decimals`);
      return { symbol, decimals };
    }
  } catch (err) {
    // Log error for debugging
    console.warn(`⚠️ Could not fetch metadata for ${tokenAddress.slice(0, 12)}...: ${err.message}`);
    // Silently use cached/default values - this is expected for some tokens
    if (cachedDecimals === undefined) {
      console.log(`ℹ️ Using default metadata for ${tokenAddress.slice(0, 12)}...`);
    }
  }

  // Default values if metadata not found
  const decimals = cachedDecimals !== undefined ? cachedDecimals : 9;
  const symbol = tokenAddress.slice(0, 8) + '...';

  if (cachedDecimals === undefined) {
    cacheDecimals(tokenAddress, decimals);
  }

  return { symbol, decimals };
}

/**
 * Fetch token decimals from on-chain metadata
 */
export async function fetchTokenDecimals(tokenAddress) {
  const metadata = await fetchTokenMetadata(tokenAddress);
  return metadata.decimals;
}

/**
 * Get all balances for an account
 */
export async function getBalances(accountOrAddress) {
  const client = await getOpsClient();
  
  let account;
  if (typeof accountOrAddress === 'string') {
    account = KeetaNet.lib.Account.fromPublicKeyString(accountOrAddress);
  } else {
    account = accountOrAddress;
  }
  
  const rawBalances = await client.allBalances({ account });
  
  return rawBalances.map((b) => ({
    token: b.token.publicKeyString?.toString() ?? b.token.toString(),
    balance: BigInt(b.balance ?? 0n),
  }));
}

/**
 * Get specific token balance for an account
 */
export async function getTokenBalance(accountAddress, tokenAddress) {
  const balances = await getBalances(accountAddress);
  const balance = balances.find((b) => b.token === tokenAddress);
  return balance?.balance ?? 0n;
}

/**
 * Create a new storage account for a pool
 */
/**
 * Create an LP storage account with dual ownership
 * User owns the account (can withdraw directly)
 * Ops has SEND_ON_BEHALF (can route swaps)
 *
 * @param {string} userAddress - User's address who will own this LP account
 * @param {string} poolIdentifier - Pool identifier (e.g., "KTA_RIDE")
 * @returns {Promise<string>} LP storage account address
 */
export async function createLPStorageAccount(userAddress, poolIdentifier) {
  const client = await getOpsClient();
  const ops = getOpsAccount();

  const builder = client.initBuilder();

  // Generate new storage account for this LP position
  const pending = builder.generateIdentifier(
    KeetaNet.lib.Account.AccountKeyAlgorithm.STORAGE
  );
  await builder.computeBlocks();

  const storageAccount = pending.account;
  const storageAddress = storageAccount.publicKeyString.toString();

  // Set storage info
  // Name must be uppercase only, no lowercase letters or numbers
  const poolShort = poolIdentifier.slice(-8).toUpperCase().replace(/[^A-Z]/g, '');
  const userShort = userAddress.slice(-8).toUpperCase().replace(/[^A-Z]/g, '');

  // Metadata must be base64 encoded
  const metadataObj = {
    pool: poolIdentifier,
    owner: userAddress,
    createdAt: Date.now()
  };
  const metadataBase64 = Buffer.from(JSON.stringify(metadataObj)).toString('base64');

  builder.setInfo(
    {
      name: `LP_${poolShort}_${userShort}`,
      description: `Liquidity position for ${poolIdentifier} owned by ${userAddress.slice(0, 20)}...`,
      metadata: metadataBase64,
      defaultPermission: new KeetaNet.lib.Permissions([
        'ACCESS',
        'STORAGE_CAN_HOLD',
      ]),
    },
    { account: storageAccount }
  );

  const userAccount = accountFromAddress(userAddress);
  const opsAddress = ops.publicKeyString.get();

  // Check if user and ops are the same account
  if (userAddress === opsAddress) {
    // Same account: grant all permissions once
    builder.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions([
        'OWNER',
        'STORAGE_DEPOSIT',
        'SEND_ON_BEHALF',
      ]),
      undefined,
      undefined,
      { account: storageAccount }
    );
  } else {
    // Different accounts: grant permissions separately
    // Grant OWNER to user (they control their funds)
    builder.updatePermissions(
      userAccount,
      new KeetaNet.lib.Permissions([
        'OWNER',
        'STORAGE_DEPOSIT',
        'SEND_ON_BEHALF', // User can withdraw their own funds
      ]),
      undefined,
      undefined,
      { account: storageAccount }
    );

    // Grant SEND_ON_BEHALF to ops (for routing swaps)
    builder.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions([
        'SEND_ON_BEHALF',
        'STORAGE_DEPOSIT',
      ]),
      undefined,
      undefined,
      { account: storageAccount }
    );
  }

  // Publish the transaction
  await client.publishBuilder(builder);

  console.log(`✅ LP storage account created: ${storageAddress}`);
  console.log(`   Owner: ${userAddress}`);
  console.log(`   Router: ${ops.publicKeyString.get()}`);

  return storageAddress;
}

export async function createStorageAccount(name, description) {
  const client = await getOpsClient();
  const ops = getOpsAccount();
  const treasury = getTreasuryAccount();
  
  const builder = client.initBuilder();
  
  // Generate new storage account
  const pending = builder.generateIdentifier(
    KeetaNet.lib.Account.AccountKeyAlgorithm.STORAGE
  );
  await builder.computeBlocks();
  
  const storageAccount = pending.account;
  const marketId = storageAccount.publicKeyString.toString();
  
  // Check if ops and treasury are the same account
  const opsAddress = ops.publicKeyString.get();
  const treasuryAddress = treasury.publicKeyString.get();
  const sameAccount = opsAddress === treasuryAddress;

  if (sameAccount) {
    // When ops and treasury are same: use defaults for tokens, grant OWNER to ops
    builder.setInfo(
      {
        name,
        description,
        metadata: '',
        defaultPermission: new KeetaNet.lib.Permissions([
          'ACCESS',
          'STORAGE_CAN_HOLD',
          'STORAGE_DEPOSIT',
        ]),
      },
      { account: storageAccount }
    );

    // Grant OWNER to ops account (overrides default for this account)
    builder.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions([
        'OWNER',
        'SEND_ON_BEHALF',
      ]),
      undefined,
      undefined,
      { account: storageAccount }
    );
  } else {
    // When different accounts: set defaults and grant specific permissions
    builder.setInfo(
      {
        name,
        description,
        metadata: '',
        defaultPermission: new KeetaNet.lib.Permissions([
          'ACCESS',
          'STORAGE_CAN_HOLD',
          'STORAGE_DEPOSIT',
        ]),
      },
      { account: storageAccount }
    );

    // Grant permissions to ops account only
    builder.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions([
        'OWNER',
        'SEND_ON_BEHALF',
        'STORAGE_DEPOSIT',
      ]),
      undefined,
      undefined,
      { account: storageAccount }
    );

    // Note: Treasury permissions can be added later when implementing fee collection
  }
  
  await client.publishBuilder(builder);
  
  return marketId;
}

// LP token functions removed - see legacy-lp-tokens/ folder
// Keeta pools use STORAGE accounts, not separate TOKEN accounts for LP tokens

/**
 * Helper to create Account objects from addresses
 */
export function accountFromAddress(address) {
  return KeetaNet.lib.Account.fromPublicKeyString(address);
}

export { KeetaNet };
