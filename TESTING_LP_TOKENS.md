# Testing LP Token Implementation

This guide explains how to test the LP token functionality to ensure everything works correctly.

---

## 📋 Test Suite Overview

We have two test scripts:

### 1. **`test-lp-token-functions.mjs`** - Quick Function Tests
Tests individual LP token functions in isolation:
- ✅ `createLPToken()` - Creates fungible LP token
- ✅ `mintLPTokens()` - Mints tokens to users
- ✅ `burnLPTokens()` - Burns tokens from users
- ✅ `getLPTokenBalance()` - Queries balance on-chain

**Use this for:** Quick verification that LP token functions work.

### 2. **`test-lp-tokens.mjs`** - Complete Lifecycle Test
Tests the full end-to-end flow:
- ✅ Pool creation with LP token
- ✅ Add liquidity (mints LP tokens)
- ✅ Remove liquidity (burns LP tokens)
- ✅ On-chain verification at each step

**Use this for:** Comprehensive testing of the complete LP token lifecycle.

---

## 🚀 Running Tests

### Prerequisites

1. **Database connection** - Tests need PostgreSQL access
   ```bash
   # Ensure DATABASE_URL is set in .env
   # Should point to your Render PostgreSQL or local DB
   ```

2. **Keeta testnet access** - Tests run on Keeta testnet
   ```bash
   # Ensure these are set in .env:
   OPS_SEED=your_ops_seed
   NETWORK=test
   NODE_HTTP=https://api.test.keeta.com
   ```

3. **Test tokens** - You need existing tokens on testnet
   - The tests use TEST and WAVE tokens by default
   - You can modify the token addresses in the test scripts

---

## Test 1: Quick Function Test

**What it tests:**
- LP token creation
- Minting LP tokens
- Burning LP tokens
- Balance queries

**How to run:**
```bash
node test-lp-token-functions.mjs
```

**Expected output:**
```
═══════════════════════════════════════════════════════
  LP TOKEN FUNCTIONS TEST
═══════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 1: Create LP Token
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Creating LP token...
✅ LP Token created successfully!
  Address: keeta_a...

🪙 LP Token Info:
  Name: TEST-WAVE LP
  Description: Liquidity Provider token for TEST/WAVE pool

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 2: Mint LP Tokens
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Checking initial balance...
  Initial balance: 0

🪙 Minting LP tokens...
✅ LP tokens minted successfully!

📊 Checking new balance...
  New balance: 1000000000
  Minted: 1000000000

✅ Balance increased as expected!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 3: Burn LP Tokens
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 Burning LP tokens...
✅ LP tokens burned successfully!

📊 Checking balance after burn...
  Burned: 500000000

✅ Balance decreased as expected!

═══════════════════════════════════════════════════════
🎉 ALL TESTS PASSED!
═══════════════════════════════════════════════════════
```

**Time to run:** ~10-15 seconds

---

## Test 2: Complete Lifecycle Test

**What it tests:**
1. Pool creation automatically creates LP token
2. Adding liquidity mints LP tokens to user
3. Removing liquidity burns LP tokens
4. On-chain state is correct at each step

**How to run:**
```bash
node test-lp-tokens.mjs
```

**Expected output:**
```
═══════════════════════════════════════════════════════
  LP TOKEN TEST SUITE
═══════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 1: Pool Creation with LP Token
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Creating pool: TEST/WAVE
  Token A: ...ckeqn52
  Token B: ...saixkym
  Creator: ...ldlrmpy

📝 Creating LP token for pool...
✅ LP token created: keeta_a...

  ✅ Pool created successfully
  ✅ Pool has LP token address
  ✅ LP token exists on-chain
  ✅ LP token has correct name

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 2: Add Liquidity (Mint LP Tokens)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Checking initial LP token balance...
  Initial balance: 0

💰 Adding liquidity...
  Amount A: 1000000000 (1 tokens)
  Amount B: 1000000000 (1 tokens)

🪙 Minting LP tokens...
✅ LP tokens minted successfully

  ✅ Initial LP token balance is 0
  ✅ Add liquidity succeeded
  ✅ LP token balance increased
  ✅ LP token balance matches minted amount
  ✅ On-chain balance matches expected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 3: Remove Liquidity (Burn LP Tokens)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💸 Removing liquidity...

🔥 Burning LP tokens...
✅ LP tokens burned successfully

  ✅ Remove liquidity succeeded
  ✅ LP token balance decreased
  ✅ LP token balance matches expected
  ✅ On-chain balance correct after burn

═══════════════════════════════════════════════════════
  TEST RESULTS
═══════════════════════════════════════════════════════

Total tests: 13
✅ Passed: 13
❌ Failed: 0
Success rate: 100.0%

═══════════════════════════════════════════════════════
🎉 ALL TESTS PASSED! LP tokens are working correctly!
═══════════════════════════════════════════════════════
```

**Time to run:** ~30-40 seconds (includes waiting for transactions)

---

## 🔍 What Each Test Verifies

### Function Tests (`test-lp-token-functions.mjs`)

| Test | What It Verifies |
|------|------------------|
| **Create LP Token** | - LP token account created on-chain<br>- Token has correct name/description<br>- Metadata includes pool info |
| **Mint LP Tokens** | - LP tokens minted to recipient<br>- Balance increases by minted amount<br>- Token appears in wallet balances |
| **Burn LP Tokens** | - LP tokens burned from user<br>- Balance decreases by burned amount<br>- Token removed if balance = 0 |

### Lifecycle Tests (`test-lp-tokens.mjs`)

| Test | What It Verifies |
|------|------------------|
| **Pool Creation** | - Pool created successfully<br>- LP token automatically created<br>- LP token address stored in pool<br>- LP token queryable on-chain |
| **Add Liquidity** | - Initial balance is 0<br>- Liquidity added successfully<br>- LP tokens minted to user<br>- Balance matches minted amount<br>- On-chain balance correct |
| **Remove Liquidity** | - LP tokens read from chain<br>- Liquidity removed successfully<br>- LP tokens burned from user<br>- Balance decreased correctly<br>- On-chain balance correct |

---

## 🐛 Troubleshooting

### Test Fails: "LP token not found on-chain"

**Cause:** Transaction didn't settle yet
**Fix:** Tests already wait 3 seconds - if still failing, increase wait time:
```javascript
await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
```

### Test Fails: "Insufficient balance"

**Cause:** OPS account doesn't have enough tokens
**Fix:**
1. Check OPS account balances on Keeta explorer
2. Get test tokens from faucet: https://faucet.test.keeta.com
3. Or use different test tokens you already have

### Test Fails: "Pool already exists"

**Cause:** Test pool from previous run still exists
**Fix:**
```bash
# Option 1: Delete from database
psql $DATABASE_URL
DELETE FROM pools WHERE pool_address = '<pool_address>';

# Option 2: Use different test tokens
# Edit the token addresses in the test file
```

### Test Fails: "DATABASE_URL not set"

**Cause:** Environment variable missing
**Fix:**
```bash
# Check .env file has:
DATABASE_URL=postgresql://...
```

### Test Fails: "OPS_SEED not set"

**Cause:** Environment variable missing
**Fix:**
```bash
# Check .env file has:
OPS_SEED=your_seed_here
NETWORK=test
NODE_HTTP=https://api.test.keeta.com
```

---

## ✅ Success Criteria

Tests pass if:

### Quick Function Test
- ✅ LP token created on-chain
- ✅ LP tokens minted successfully
- ✅ Balance increased by minted amount
- ✅ LP tokens burned successfully
- ✅ Balance decreased by burned amount

### Complete Lifecycle Test
- ✅ Pool created with LP token
- ✅ LP token address stored in pool
- ✅ Adding liquidity mints LP tokens
- ✅ LP token balance matches expected
- ✅ Removing liquidity burns LP tokens
- ✅ On-chain state correct at each step

---

## 📊 Verifying On-Chain

After tests pass, you can manually verify on Keeta explorer:

### Check LP Token
```
1. Copy LP token address from test output
2. Go to: https://explorer.test.keeta.com
3. Search for the LP token address
4. Verify:
   - Account type: TOKEN
   - Name: TEST-WAVE LP (or similar)
   - Description: Liquidity Provider token...
```

### Check User Balance
```
1. Copy OPS address (or user address)
2. Go to: https://explorer.test.keeta.com
3. Search for the address
4. Check balances tab
5. Verify LP token appears with correct balance
```

### Check Pool Account
```
1. Copy pool address from test output
2. Go to: https://explorer.test.keeta.com
3. Search for the pool address
4. Verify:
   - Has reserves (tokenA and tokenB)
   - Account type: STORAGE
   - Permissions: Creator has OWNER, OPS has SEND_ON_BEHALF
```

---

## 🔄 Running Tests Multiple Times

**First run:** Creates new pool, LP token, adds/removes liquidity

**Subsequent runs:**
- If pool exists, uses existing pool
- Only tests add/remove liquidity
- To start fresh, delete test pool from database

---

## 📝 Next Steps After Tests Pass

1. ✅ **Test new pool creation via API**
   ```bash
   curl -X POST http://localhost:8080/api/pools/create \
     -H "Content-Type: application/json" \
     -d '{
       "tokenA": "keeta_...",
       "tokenB": "keeta_...",
       "creatorAddress": "keeta_..."
     }'
   ```

2. ✅ **Test add liquidity via API**
   ```bash
   curl -X POST http://localhost:8080/api/liquidity/add \
     -H "Content-Type: application/json" \
     -d '{
       "poolAddress": "keeta_...",
       "userAddress": "keeta_...",
       "amountA": "1000000000",
       "amountB": "1000000000"
     }'
   ```

3. ✅ **Test remove liquidity via API**
   ```bash
   curl -X POST http://localhost:8080/api/liquidity/remove \
     -H "Content-Type: application/json" \
     -d '{
       "poolAddress": "keeta_...",
       "userAddress": "keeta_...",
       "liquidity": "500000000"
     }'
   ```

4. ✅ **Update frontend** to display LP token balances

5. ✅ **Deploy to production** once tests pass

---

## 🎯 Summary

**Run both tests to verify:**
1. Individual LP token functions work ✅
2. Complete pool lifecycle works ✅
3. On-chain state is correct ✅

**Once tests pass:**
- LP token implementation is production-ready
- Users will receive fungible LP tokens
- Tokens can be transferred/traded
- Fully composable with other protocols

---

**Questions?** Check:
- `LP_TOKEN_IMPLEMENTATION.md` - Technical details
- `docs/keeta-dex-guide.md` - DEX architecture
- Test script comments - In-line documentation
