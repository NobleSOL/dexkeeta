# Keythings Wallet Implementation Guide

## Overview

This document describes the complete Keythings wallet integration for the Keeta DEX. Keythings is a browser extension wallet that will eventually be the **primary wallet** for interacting with the DEX.

**Last Updated:** 2025-01-17
**Status:** Production-Ready ✅
**Commits:** `84123fb` (LP token minting), `7a2be57` (database save)

---

## Table of Contents

1. [Architecture](#architecture)
2. [Two-Transaction Liquidity Flow](#two-transaction-liquidity-flow)
3. [Implementation Details](#implementation-details)
4. [Bugs Fixed](#bugs-fixed)
5. [Current Limitations](#current-limitations)
6. [Testing](#testing)
7. [Future Improvements](#future-improvements)

---

## Architecture

### Why Two Transactions?

Keythings wallets expose a **placeholder seed** for compatibility, but this seed cannot be used to sign transactions or create derived accounts. The wallet only signs transactions for its own address.

This creates a challenge for liquidity provision, which traditionally requires:
- User sending tokens to pool
- Backend minting LP tokens to user

**Solution:** Split into two separate transactions:
- **TX1:** User sends `tokenA + tokenB` to pool (signed by Keythings)
- **TX2:** Backend mints LP tokens to user (signed by OPS account)

### Key Components

```
Frontend (client/components/keeta/)
├── KeetaDex.tsx          # Main DEX UI
└── AddLiquidityModal.tsx # Liquidity addition interface

Backend (server/keeta-impl/)
├── routes/
│   ├── liquidity.js          # Pool creation endpoint
│   └── liquidity-keythings.js # TX2 completion endpoint
├── contracts/
│   ├── Pool.js               # Pool state management
│   └── PoolManager.js        # Pool coordination
└── utils/
    └── client.js             # LP token creation & minting

Database (PostgreSQL)
├── pools                 # Pool metadata & LP token addresses
└── lp_positions          # User position tracking
```

---

## Two-Transaction Liquidity Flow

### Complete Flow Diagram

```
┌─────────────┐
│   User UI   │
└──────┬──────┘
       │
       │ 1. User clicks "Add Liquidity"
       ▼
┌─────────────────────────────┐
│ POST /api/liquidity/add     │
│ - Create pool (if needed)   │
│ - Return poolAddress        │
└──────┬──────────────────────┘
       │
       │ 2. poolAddress received
       ▼
┌─────────────────────────────────────┐
│ TX1: User→ Pool (via Keythings)     │
│ - Keythings prompts user signature  │
│ - Sends tokenA + tokenB to pool     │
└──────┬──────────────────────────────┘
       │
       │ 3. TX1 confirmed
       ▼
┌──────────────────────────────────────────────┐
│ POST /api/liquidity/keythings/complete      │
│ TX2: Mint LP tokens (via OPS account)       │
│ - Calculate LP shares                        │
│ - modifyTokenSupply() + send()               │
│ - Save position to database                  │
└──────┬───────────────────────────────────────┘
       │
       │ 4. Success response
       ▼
┌─────────────────────┐
│ LP tokens in wallet │
└─────────────────────┘
```

### Step-by-Step Flow

#### Step 1: Pool Creation

**Endpoint:** `POST /api/liquidity/add`

```javascript
// Request
{
  creatorAddress: "keeta_aabft...",  // From Keythings
  tokenA: "keeta_anyif...",
  tokenB: "keeta_ambwb...",
  amountADesired: "1",               // Human-readable
  amountBDesired: "100000"
}

// Response
{
  success: true,
  poolAddress: "keeta_at6hh...",
  requiresKeythingsLiquidity: true
}
```

**Backend Actions:**
1. Check if pool exists for this token pair
2. If not, create pool account + LP token
3. Save pool to database with LP token address
4. Return pool address to frontend

**File:** `server/keeta-impl/routes/liquidity.js:36-144`

#### Step 2: User Sends Tokens (TX1)

**Frontend Action:**
```typescript
// Use Keythings client to build TX1
const client = await getKeythingsClient();
const builder = client.initBuilder();

// Send tokenA to pool
builder.send(poolAccount, amountAAtomicBigInt, tokenAAccount);

// Send tokenB to pool
builder.send(poolAccount, amountBAtomicBigInt, tokenBAccount);

// Keythings prompts user for signature
await client.publishBuilder(builder);
```

**User sees:** Keythings popup requesting signature for multi-operation transaction

**File:** `client/lib/keeta-client.ts:142-236`

#### Step 3: Backend Mints LP Tokens (TX2)

**Endpoint:** `POST /api/liquidity/keythings/complete`

```javascript
// Request
{
  userAddress: "keeta_aabft...",
  poolAddress: "keeta_at6hh...",
  tokenA: "keeta_anyif...",
  tokenB: "keeta_ambwb...",
  amountA: "1000000000",      // Atomic units
  amountB: "100000000000"
}

// Response
{
  success: true,
  result: {
    liquidity: "316227765016",  // LP shares minted
    amountA: "1",
    amountB: "100000",
    newReserveA: "1",
    newReserveB: "100000"
  }
}
```

**Backend Actions:**
1. Fetch pool reserves from blockchain
2. Calculate LP shares using Uniswap V2 formula:
   ```javascript
   if (totalSupply === 0n) {
     // First liquidity
     liquidity = sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
   } else {
     // Subsequent liquidity
     liquidity = min(
       (amountA * totalSupply) / reserveA,
       (amountB * totalSupply) / reserveB
     );
   }
   ```
3. Mint LP tokens using two-step process:
   ```javascript
   // Step 1: Create new tokens in LP token account
   builder.modifyTokenSupply(liquidity, { account: lpTokenAccount });
   await client.publishBuilder(builder);

   // Step 2: Send tokens from LP account to user
   builder.send(userAccount, liquidity, lpTokenAccount, { account: lpTokenAccount });
   await client.publishBuilder(builder);
   ```
4. Update pool reserves in memory
5. Save LP position to database

**File:** `server/keeta-impl/routes/liquidity-keythings.js:28-191`

---

## Implementation Details

### LP Token Creation

**Function:** `createLPToken(poolAddress, tokenA, tokenB)`
**File:** `server/keeta-impl/utils/client.js:404-509`

```javascript
// 1. Generate LP token account
const lpTokenAccount = builder.generateIdentifier(TOKEN);

// 2. Set metadata (critical for position discovery!)
const metadataObj = {
  type: 'LP_TOKEN',     // Used by frontend to find LP tokens
  pool: poolAddress,
  tokenA,
  tokenB,
  createdAt: Date.now()
};

builder.setInfo({
  name: `${symbolA}_${symbolB}_LP`,
  description: 'Silverback Liquidity Token',
  metadata: Buffer.from(JSON.stringify(metadataObj)).toString('base64'),
});

// 3. Grant OPS permissions
builder.updatePermissions(ops, new Permissions([
  'OWNER',           // Modify supply
  'SEND_ON_BEHALF'   // Send from LP token account
]), { account: lpTokenAccount });

// 4. Publish and verify
await client.publishBuilder(builder);
await verifyLPTokenCreated(lpTokenAddress);
```

**Critical Details:**
- Metadata MUST include `type: 'LP_TOKEN'` for frontend discovery
- OPS needs OWNER permission to mint tokens
- SEND_ON_BEHALF allows OPS to send from LP token account
- Verification step ensures token exists before returning

### LP Token Minting

**Function:** `mintLPTokens(lpTokenAddress, recipientAddress, amount)`
**File:** `server/keeta-impl/utils/client.js:534-565`

**Two-Step Process:**

```javascript
// TX1: Create tokens
builder.modifyTokenSupply(amount, { account: lpTokenAccount });
await client.publishBuilder(builder);

// Wait for finalization
await sleep(2000);

// TX2: Send to user
builder.send(
  recipientAccount,           // TO: user
  amount,                     // amount
  lpTokenAccount,             // which token
  undefined,                  // no external ref
  { account: lpTokenAccount } // FROM: LP token account
);
await client.publishBuilder(builder);
```

**Why Two Steps?**
- Keeta tokens don't have initial supply
- `modifyTokenSupply()` creates new tokens in the token account's own balance
- Then `send()` transfers those tokens to the recipient

**⚠️ IMPORTANT:** Do NOT try to initialize LP tokens by sending to themselves. This was tried in commit `5ba5dfe` and failed with "negative balance" errors.

### Database Schema

```sql
-- Pools table
CREATE TABLE pools (
  id SERIAL PRIMARY KEY,
  pool_address TEXT UNIQUE NOT NULL,
  token_a TEXT NOT NULL,
  token_b TEXT NOT NULL,
  lp_token_address TEXT,           -- Critical for TX2!
  creator TEXT NOT NULL,
  pair_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LP positions table
CREATE TABLE lp_positions (
  id SERIAL PRIMARY KEY,
  pool_address TEXT NOT NULL,
  user_address TEXT NOT NULL,
  shares NUMERIC NOT NULL,          -- LP token balance
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pool_address, user_address)
);
```

**File:** `server/keeta-impl/db/pool-repository.js`

---

## Bugs Fixed

### Bug #1: Token Decimal Hardcoding (Frontend)
**Commit:** `ffc8e46`
**Issue:** Frontend hardcoded 9 decimals for all tokens
**Impact:** Calculated wrong amounts for RIDE (5 decimals)
**Fix:** Added `fetchTokenDecimals()` to query actual decimals

```javascript
// Before (WRONG)
const amountAtomic = amount * 10**9;  // Always 9!

// After (CORRECT)
const decimals = await fetchTokenDecimals(tokenAddress);
const amountAtomic = amount * 10**decimals;
```

### Bug #2: Missing LP Token Address (Backend)
**Commit:** `9e41986`
**Issue:** `pool.lpTokenAddress` undefined for existing pools
**Impact:** TX2 failed with "LP token address not found"
**Fix:** Added database lookup fallback

```javascript
if (!pool.lpTokenAddress) {
  const poolData = await repository.getPoolByAddress(poolAddress);
  pool.lpTokenAddress = poolData.lp_token_address;
}
```

### Bug #3: totalSupply Undefined (Backend)
**Commit:** `25bcfbc`
**Issue:** Tried to read `pool.totalSupply` which doesn't exist
**Impact:** LP share calculation failed
**Fix:** Fetch supply from LP token account

```javascript
const lpTokenInfo = await client.getAccountsInfo([pool.lpTokenAddress]);
const totalSupply = BigInt(lpTokenInfo[pool.lpTokenAddress].info.supply);
```

### Bug #4: Incorrect send() Parameters (Backend)
**Commit:** `e0e4d28`
**Issue:** Passed `undefined` as token parameter
**Impact:** Transaction building failed
**Fix:** Pass `lpTokenAccount` as 3rd parameter

```javascript
// Before (WRONG)
builder.send(userAccount, liquidity, undefined);

// After (CORRECT)
builder.send(userAccount, liquidity, lpTokenAccount);
```

### Bug #5: LP Token Minting (Backend)
**Commit:** `84123fb` ⭐
**Issue:** Tried to send LP tokens before creating supply
**Impact:** "Negative balance" error when minting
**Fix:** Use `modifyTokenSupply()` then `send()` pattern

```javascript
// Before (WRONG - tried to initialize with self-send)
builder.send(lpTokenAccount, MAX_SUPPLY, lpTokenAccount, { account: lpTokenAccount });

// After (CORRECT - use modifyTokenSupply)
await mintLPTokens(lpTokenAddress, userAddress, liquidity);
// Internally: modifyTokenSupply() + send()
```

### Bug #6: Database Save Parameter Order (Backend)
**Commit:** `7a2be57`
**Issue:** Passed `(userAddress, poolAddress, tokenA, tokenB, liquidity)` instead of `(poolAddress, userAddress, liquidity)`
**Impact:** tokenA address passed as numeric `shares` field → SQL error
**Fix:** Correct parameter order

```javascript
// Before (WRONG)
await repository.saveLPPosition(userAddress, poolAddress, tokenA, tokenB, liquidity);

// After (CORRECT)
await repository.saveLPPosition(poolAddress, userAddress, liquidity);
```

---

## Current Limitations

### 1. Position Display (Keythings Wallets)

**Problem:** The `fetchLiquidityPositions()` function requires a seed to create a client:

```typescript
// Current implementation (client/lib/keeta-client.ts:362)
export async function fetchLiquidityPositions(seed: string, accountIndex: number = 0) {
  const account = KeetaSDK.lib.Account.fromSeed(seedBytes, accountIndex);
  const balances = await client.allBalances({ account });
  // ... filter for LP tokens
}
```

**Impact:** Keythings wallets can't fetch positions because they don't expose real seeds.

**Workaround:** Positions ARE successfully created on-chain, just not displayed in UI.

**Solution Needed:** Create address-based position fetching (see Future Improvements).

### 2. Swap Not Yet Implemented

**Status:** Only liquidity addition is implemented for Keythings wallets.

**TODO:** Implement two-transaction swap flow similar to liquidity:
- TX1: User sends input token to pool
- TX2: Backend calculates output and sends output token to user

### 3. Remove Liquidity Not Implemented

**Status:** Liquidity removal not yet implemented for Keythings wallets.

**TODO:** Implement reverse flow:
- TX1: User sends LP tokens to pool
- TX2: Backend burns LP tokens and sends underlying tokens to user

---

## Testing

### Manual Test Checklist

**Prerequisites:**
- Keythings wallet installed and connected
- Test tokens (KTA, MOON, RIDE, etc.) in wallet

**Test Steps:**

1. **Pool Creation**
   ```
   ☐ Select two tokens not yet paired
   ☐ Click "Add Liquidity"
   ☐ Backend creates pool + LP token
   ☐ Returns poolAddress
   ```

2. **TX1: Send Tokens**
   ```
   ☐ Keythings popup appears
   ☐ Shows correct token amounts
   ☐ User approves transaction
   ☐ Tokens appear in pool on blockchain
   ```

3. **TX2: Mint LP Tokens**
   ```
   ☐ Backend calculates LP shares
   ☐ Mints tokens via modifyTokenSupply + send
   ☐ LP tokens appear in user wallet
   ☐ Position saved to database
   ```

4. **Verification**
   ```
   ☐ Check pool reserves on blockchain
   ☐ Check LP token balance in wallet
   ☐ Check database lp_positions table
   ☐ Verify LP token metadata includes type: 'LP_TOKEN'
   ```

### Example Successful Test

```
Pool: keeta_at6hh7crtexpzit5uu2tgjdggctvg2adlp47i
LP Token: keeta_ap7dnglsgdw7jxgqb7fqxzdjubfklczv4h6l5tvq

TX1: 1 KTA + 100,000 MOON → Pool
TX2: 316,227,765,016 LP tokens → User

✅ All steps completed successfully
❌ Position not displayed in UI (known limitation)
```

### Debugging Scripts

```bash
# Check if pool exists on-chain
node check-latest-pool.mjs

# Verify LP token was created
node check-lp-token-balance.mjs <LP_TOKEN_ADDRESS> <USER_ADDRESS>

# Check pool reserves
node check-pool-liquidity.mjs <POOL_ADDRESS>
```

---

## Future Improvements

### Priority 1: Fix Position Display

**Goal:** Show Keythings wallet LP positions in UI

**Approach:** Create backend endpoint to fetch positions by address

```javascript
// New endpoint: GET /api/liquidity/positions-by-address/:userAddress
async function getPositionsByAddress(userAddress) {
  // 1. Query database for all LP positions
  const dbPositions = await repository.getUserPositions(userAddress);

  // 2. For each position, fetch on-chain LP token balance
  const positions = await Promise.all(dbPositions.map(async (pos) => {
    const balance = await fetchTokenBalance(pos.lp_token_address, userAddress);
    const totalSupply = await fetchLPTokenSupply(pos.lp_token_address);
    const poolReserves = await fetchPoolReserves(pos.pool_address);

    return calculatePositionDetails(balance, totalSupply, poolReserves);
  }));

  return positions;
}
```

**Frontend Change:**
```typescript
// Check wallet type
if (isKeythingsWallet) {
  // Use address-based fetching
  positions = await fetch(`/api/liquidity/positions-by-address/${address}`);
} else {
  // Use seed-based fetching
  positions = await fetchLiquidityPositions(seed);
}
```

### Priority 2: Implement Swap

**Flow:**
```
1. User enters swap amount
2. Frontend queries pool reserves
3. Calculates output amount (with slippage)
4. TX1: User sends input token to pool (Keythings)
5. TX2: Backend sends output token to user (OPS)
```

**Endpoint:** `POST /api/swap/keythings/complete`

### Priority 3: Implement Remove Liquidity

**Flow:**
```
1. User selects LP position to remove
2. Frontend calculates underlying token amounts
3. TX1: User sends LP tokens to pool (Keythings)
4. TX2: Backend burns LP tokens and sends tokens to user (OPS)
```

**Endpoint:** `POST /api/liquidity/keythings/remove`

### Priority 4: Optimize TX2 Timing

**Current:** Frontend polls server or waits fixed time
**Better:** Use webhooks or WebSocket to notify when TX2 completes

### Priority 5: Add Transaction History

**Goal:** Show users their past liquidity additions, swaps, removals

**Approach:**
- Store all transactions in database
- Create `/api/transactions/:userAddress` endpoint
- Display in Portfolio page

---

## Production Deployment

### Environment Variables

```bash
# Backend
OPS_SEED=<64-char hex seed for operations account>
DATABASE_URL=postgresql://user:pass@host/db

# Frontend
VITE_API_URL=https://api.dexkeeta.com
VITE_KEETA_NETWORK=https://api.test.keeta.com/rpc
```

### Deployment Checklist

```
☐ All 6 bugs fixed and deployed
☐ Database migrations applied
☐ OPS account funded with KTA for fees
☐ Test on testnet with real Keythings wallet
☐ Monitor server logs for errors
☐ Set up error alerting (Sentry, etc.)
```

### Monitoring

**Key Metrics:**
- Pool creation success rate
- TX2 completion time
- LP token minting failures
- Database query latency

**Log Searches:**
```
"❌ Keythings add liquidity completion error"
"✅ TX2 completed"
"💎 LP shares to mint"
```

---

## Support & Debugging

### Common Issues

**Issue:** "Pool not found" error
**Solution:** Pool creation might have failed. Check server logs for pool creation errors.

**Issue:** "LP token address not found"
**Solution:** LP token wasn't created or database wasn't updated. Check `pools` table `lp_token_address` column.

**Issue:** "Negative balance" error during TX2
**Solution:** Ensure using latest code (commit `84123fb`+) with correct `mintLPTokens()` pattern.

**Issue:** Position not showing in UI
**Solution:** Known limitation. Verify position exists on-chain using `check-lp-token-balance.mjs`.

### Getting Help

1. Check server logs for detailed error messages
2. Use debugging scripts to verify on-chain state
3. Review this documentation for implementation details
4. Check recent commits for related fixes

---

## Conclusion

The Keythings wallet integration is **production-ready** for liquidity addition. The two-transaction flow successfully handles the constraint that Keythings wallets can only sign transactions for their own address.

**Key Achievements:**
- ✅ Pool creation with automatic LP token generation
- ✅ Two-transaction liquidity addition flow
- ✅ Proper LP token minting using `modifyTokenSupply()` pattern
- ✅ Database persistence of pools and positions
- ✅ All critical bugs fixed and tested

**Next Steps:**
- Implement position display for Keythings wallets
- Add swap functionality
- Add remove liquidity functionality
- Improve UX with transaction status updates

For questions or issues, refer to commit history or contact the development team.
