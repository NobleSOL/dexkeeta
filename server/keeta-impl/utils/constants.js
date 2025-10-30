// src/utils/constants.js
import 'dotenv/config';

export const CONFIG = {
  // Network
  NETWORK: process.env.NETWORK || 'test',
  NODE_HTTP: process.env.NODE_HTTP || 'https://api.test.keeta.com',
  
  // Fees (basis points: 30 = 0.3%)
  SWAP_FEE_BPS: Number(process.env.SWAP_FEE_BPS || 30),
  
  // Known tokens
  BASE_TOKEN: process.env.BASE_TOKEN || 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
  
  // Server
  PORT: Number(process.env.PORT || 8888),
  CORS_ORIGINS: process.env.CORS_ALLOWED_ORIGINS?.split(',') || '*',
};

// Helper to convert basis points to fraction
export function bpsToFraction(bps) {
  return {
    numerator: BigInt(bps),
    denominator: 10000n,
  };
}

// Helper: Convert human amount to atomic
export function toAtomic(amount, decimals) {
  return BigInt(Math.round(amount * 10 ** decimals));
}

// Helper: Convert atomic amount to human
export function fromAtomic(amount, decimals) {
  return Number(amount) / 10 ** decimals;
}

// Helper: Format token pair key
export function getPairKey(tokenA, tokenB) {
  // Sort alphabetically to ensure consistent keys
  const [token0, token1] = [tokenA, tokenB].sort();
  return `${token0}_${token1}`;
}

// Helper: Parse pair key
export function parsePairKey(pairKey) {
  const [token0, token1] = pairKey.split('_');
  return { token0, token1 };
}

// Helper: Validate hex seed
export function validateHexSeed(seed) {
  return /^[0-9A-Fa-f]{64}$/.test(seed.trim());
}

// Helper: Load seed from env
export function seedFromHexEnv(varName) {
  const raw = process.env[varName];
  if (!raw) throw new Error(`${varName} missing in .env`);
  if (!validateHexSeed(raw)) {
    throw new Error(`${varName} must be 64 hex characters`);
  }
  return Buffer.from(raw.trim(), 'hex');
}

// Token decimals cache (in-memory for now)
const decimalsCache = new Map();

// Pre-populate known tokens
const KNOWN_TOKEN_DECIMALS = {
  // KTA token
  'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52': 9,
  // RIDE token
  'keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo': 5,
};

// Initialize cache with known tokens
Object.entries(KNOWN_TOKEN_DECIMALS).forEach(([address, decimals]) => {
  decimalsCache.set(address, decimals);
});

export function cacheDecimals(tokenAddress, decimals) {
  decimalsCache.set(tokenAddress, decimals);
}

export function getCachedDecimals(tokenAddress) {
  return decimalsCache.get(tokenAddress);
}
