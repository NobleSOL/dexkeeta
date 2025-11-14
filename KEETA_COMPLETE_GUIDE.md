# Complete Keeta Development Guide
## Combining Docs, Web Research, and Real Implementation

---

## ⚠️ CRITICAL: Documentation vs Reality

**IMPORTANT**: The documentation in `docs/` shows HYPOTHETICAL APIs that don't match the actual SDK:

### ❌ Docs Show (Doesn't Exist):
```javascript
const { KeetaNetClient } = require('@keetanetwork/keetanet-client');
const client = new KeetaNetClient({ network: 'test' });
await client.createToken(wallet, params);
await client.sendTransaction({...});
```

### ✅ Actual SDK (What Works):
```javascript
import * as KeetaNet from '@keetanetwork/keetanet-client';
const account = KeetaNet.lib.Account.fromSeed(seed, 0);
const client = KeetaNet.UserClient.fromNetwork('test', account);
const builder = client.initBuilder();
builder.generateIdentifier(...);
builder.setInfo(...);
builder.modifyTokenSupply(...);
await client.publishBuilder(builder);
```

---

## 1. Keeta Network Overview

### What is Keeta?
- **High-performance L1 blockchain** for payments and asset transfers
- **11M TPS** verified with 400ms settlement
- **Hybrid DAG + DPoS** consensus
- **Google Spanner** backend for ledger storage
- **Native tokenization** at protocol level (no smart contracts)
- **Built-in compliance** (KYC/AML via X.509 certificates)

### Status
- Mainnet: September 2025
- Funding: $17M led by Eric Schmidt (former Google CEO)
- Listed: Coinbase, Kraken, Aerodrome DEX on Base

---

## 2. Core Architecture (From Research + Docs)

### Per-Account DAG Chains
- Each account maintains its own DAG chain
- No global blockchain or mempool
- Parallel transaction processing

### Two-Phase Consensus
1. **Temporary Votes** (5-minute validity)
   - Representatives vote on block validity
   - Establish quorum for consensus
   - Can be cached by witness nodes

2. **Permanent Votes** (immutable)
   - Requested after temporary vote quorum
   - Bundled with blocks into vote staples
   - X.509 certificate signed

### Vote Staples
- Transaction unit containing blocks + votes
- All blocks applied atomically
- Broadcast to network after quorum

---

## 3. ACTUAL Account Types (Working SDK)

### From Our Real Code:

```javascript
// KEY_PAIR Account (holds private keys)
const seed = Uint8Array.from(Buffer.from(hexSeed, 'hex'));
const account = KeetaNet.lib.Account.fromSeed(seed, 0);

// TOKEN Account (fungible asset)
const builder = client.initBuilder();
const pending = builder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.TOKEN
);
await builder.computeBlocks();
const tokenAccount = pending.account;

// STORAGE Account (holds assets like a pool)
const pending = builder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.STORAGE
);
await builder.computeBlocks();
const storageAccount = pending.account;
```

### Account Properties
- **address**: `keeta_` + base32 encoded public key
- **Each account**: Own DAG chain, balance map, permissions
- **Metadata**: Base64-encoded JSON (REQUIRED for setInfo)

---

## 4. ACTUAL Operations (Working SDK)

### Creating a Token

```javascript
// 1. Generate token account
const builder = client.initBuilder();
const pending = builder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.TOKEN
);
await builder.computeBlocks();
const tokenAccount = pending.account;
const tokenAddress = tokenAccount.publicKeyString.toString();

// 2. Set token info (metadata REQUIRED!)
builder.setInfo({
  name: 'My Token',
  description: 'My awesome token',
  metadata: Buffer.from(JSON.stringify({
    symbol: 'MTK',
    decimals: 9,
    type: 'TOKEN',
    creator: creatorAddress
  })).toString('base64'),
  defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'])
}, { account: tokenAccount });

// 3. Grant creator admin permissions
builder.updatePermissions(
  creatorAccount,
  new KeetaNet.lib.Permissions([
    'TOKEN_ADMIN_SUPPLY',
    'TOKEN_ADMIN_MODIFY_BALANCE'
  ]),
  undefined,
  undefined,
  { account: tokenAccount }
);

// 4. Publish
await client.publishBuilder(builder);
```

### Minting Tokens

```javascript
const builder = client.initBuilder();

// 1. Increase supply
builder.modifyTokenSupply(
  tokenAccount,
  amount,  // positive to mint
  { account: tokenAccount }
);

// 2. Credit recipient
builder.modifyTokenBalance(
  recipientAccount,
  tokenAccount,
  amount,
  { account: tokenAccount }
);

await client.publishBuilder(builder);
```

### Burning Tokens

```javascript
const builder = client.initBuilder();

// 1. Debit holder
builder.modifyTokenBalance(
  holderAccount,
  tokenAccount,
  -amount,  // negative to deduct
  { account: tokenAccount }
);

// 2. Decrease supply
builder.modifyTokenSupply(
  tokenAccount,
  -amount,  // negative to burn
  { account: tokenAccount }
);

await client.publishBuilder(builder);
```

### Transferring Tokens

```javascript
const builder = client.initBuilder();

builder.send(
  recipientAccount,
  amount,
  tokenAccount
);

await client.publishBuilder(builder);
```

---

## 5. ACTUAL DEX Implementation (Working Pattern)

### Pool (Storage Account) Creation

```javascript
// 1. Generate pool storage account
const poolBuilder = client.initBuilder();
const poolPending = poolBuilder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.STORAGE
);
await poolBuilder.computeBlocks();
const poolAccount = poolPending.account;
const poolAddress = poolAccount.publicKeyString.toString();

// 2. Set pool metadata (REQUIRED!)
poolBuilder.setInfo({
  name: 'TOKEN_A_TOKEN_B_POOL',
  description: 'Liquidity Pool for Token A and Token B',
  metadata: Buffer.from(JSON.stringify({
    type: 'POOL',
    tokenA: tokenAAddress,
    tokenB: tokenBAddress,
    createdAt: Date.now()
  })).toString('base64'),
  defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'])
}, { account: poolAccount });

// 3. Grant pool operator OWNER permission
poolBuilder.updatePermissions(
  operatorAccount,
  new KeetaNet.lib.Permissions(['OWNER']),
  undefined,
  undefined,
  { account: poolAccount }
);

// 4. Allow tokens to be held in pool (CRITICAL!)
poolBuilder.updatePermissions(
  tokenAAccount,
  new KeetaNet.lib.Permissions(['STORAGE_CAN_HOLD', 'ACCESS']),
  undefined,
  undefined,
  { account: poolAccount }
);

poolBuilder.updatePermissions(
  tokenBAccount,
  new KeetaNet.lib.Permissions(['STORAGE_CAN_HOLD', 'ACCESS']),
  undefined,
  undefined,
  { account: poolAccount }
);

await client.publishBuilder(poolBuilder);
```

### LP Token Creation

```javascript
// 1. Generate LP token
const lpBuilder = client.initBuilder();
const lpPending = lpBuilder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.TOKEN
);
await lpBuilder.computeBlocks();
const lpTokenAccount = lpPending.account;
const lpTokenAddress = lpTokenAccount.publicKeyString.toString();

// 2. Set LP token metadata
lpBuilder.setInfo({
  name: 'TOKEN_A_TOKEN_B_LP',
  description: 'Liquidity Provider token for A/B pool',
  metadata: Buffer.from(JSON.stringify({
    symbol: 'A-B-LP',
    decimals: 9,
    type: 'LP_TOKEN',
    pool: poolAddress,
    tokenA: tokenAAddress,
    tokenB: tokenBAddress
  })).toString('base64'),
  defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'])
}, { account: lpTokenAccount });

// 3. Grant pool admin permissions over LP token
lpBuilder.updatePermissions(
  poolAccount,  // Pool account controls LP token
  new KeetaNet.lib.Permissions([
    'TOKEN_ADMIN_SUPPLY',
    'TOKEN_ADMIN_MODIFY_BALANCE'
  ]),
  undefined,
  undefined,
  { account: lpTokenAccount }
);

await client.publishBuilder(lpBuilder);
```

### Add Liquidity Flow

```javascript
// STEP 1: User sends tokens to pool
const depositBuilder = client.initBuilder();

depositBuilder.send(
  poolAccount,
  amountA,
  tokenAAccount
);

depositBuilder.send(
  poolAccount,
  amountB,
  tokenBAccount
);

await client.publishBuilder(depositBuilder);

// Wait for settlement
await new Promise(resolve => setTimeout(resolve, 5000));

// STEP 2: Pool mints LP tokens to user
const mintBuilder = client.initBuilder();

// Calculate LP shares (first LP: sqrt(a*b), subsequent: proportional)
const lpShares = BigInt(Math.floor(Math.sqrt(Number(amountA) * Number(amountB))));

// Mint supply
mintBuilder.modifyTokenSupply(
  lpTokenAccount,
  lpShares,
  { account: lpTokenAccount }
);

// Credit user
mintBuilder.modifyTokenBalance(
  userAccount,
  lpTokenAccount,
  lpShares,
  { account: lpTokenAccount }
);

await client.publishBuilder(mintBuilder);
```

### Remove Liquidity Flow

```javascript
// STEP 1: Burn LP tokens from user
const burnBuilder = client.initBuilder();

// Debit user
burnBuilder.modifyTokenBalance(
  userAccount,
  lpTokenAccount,
  -lpShares,
  { account: lpTokenAccount }
);

// Burn supply
burnBuilder.modifyTokenSupply(
  lpTokenAccount,
  -lpShares,
  { account: lpTokenAccount }
);

await client.publishBuilder(burnBuilder);

// Wait for settlement
await new Promise(resolve => setTimeout(resolve, 5000));

// STEP 2: Return tokens from pool to user
const returnBuilder = client.initBuilder();

// Pool must have SEND_ON_BEHALF permission or use poolAccount to send
returnBuilder.send(
  userAccount,
  amountA,
  tokenAAccount,
  undefined,
  { account: poolAccount }  // Send on behalf of pool
);

returnBuilder.send(
  userAccount,
  amountB,
  tokenBAccount,
  undefined,
  { account: poolAccount }
);

await client.publishBuilder(returnBuilder);
```

### Swap Flow

```javascript
// Calculate output using constant product formula (x * y = k)
function calculateSwapOutput(amountIn, reserveIn, reserveOut, feeBps = 30) {
  const amountInWithFee = amountIn * BigInt(10000 - feeBps);
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 10000n) + amountInWithFee;
  return numerator / denominator;
}

// Execute swap
const swapBuilder = client.initBuilder();

// User sends input token to pool
swapBuilder.send(
  poolAccount,
  amountIn,
  tokenInAccount
);

// Pool sends output token to user
swapBuilder.send(
  userAccount,
  amountOut,
  tokenOutAccount,
  undefined,
  { account: poolAccount }
);

await client.publishBuilder(swapBuilder);
```

---

## 6. Permissions Model (ACTUAL)

### Base Permissions

| Permission | Purpose |
|------------|---------|
| `ACCESS` | Basic resource access |
| `OWNER` | Full control (create, delete, transfer) |
| `ADMIN` | All actions except ownership changes |
| `TOKEN_ADMIN_SUPPLY` | Mint/burn token supply |
| `TOKEN_ADMIN_MODIFY_BALANCE` | Directly modify balances |
| `STORAGE_CAN_HOLD` | Token can be stored in this account |
| `SEND_ON_BEHALF` | Send from another account |
| `UPDATE_INFO` | Modify account metadata |

### Granting Permissions

```javascript
builder.updatePermissions(
  principalAccount,           // Who gets permission
  new KeetaNet.lib.Permissions(['OWNER', 'ADMIN']),  // What permissions
  undefined,                  // Target (unused for basic grants)
  undefined,                  // Method (ADD, REMOVE, REPLACE)
  { account: resourceAccount } // Which account's permissions to modify
);
```

---

## 7. Query Operations (Read-Only)

### Get Balances

```javascript
import { getBalances } from './server/keeta-impl/utils/client.js';

const balances = await getBalances(address);
// Returns: [{ token: 'keeta_...', balance: 1000n, value: '1000' }, ...]
```

### Get Account Info

```javascript
const accountsInfo = await client.client.getAccountsInfo([address]);
const info = accountsInfo[address];
// info.info.name, info.info.description, info.info.metadata
// info.balance, info.headBlocks
```

### Get Token Balance

```javascript
const balances = await getBalances(userAddress);
const tokenBalance = balances.find(b => b.token === tokenAddress);
const amount = tokenBalance ? tokenBalance.balance : 0n;
```

---

## 8. Critical Best Practices (From Experience)

### 1. NEVER Create Concurrent Builders for Same Account
```javascript
// ❌ WRONG - Creates DAG fork!
const builder1 = client.initBuilder();
const builder2 = client.initBuilder();
await Promise.all([
  client.publishBuilder(builder1),
  client.publishBuilder(builder2)
]);

// ✅ CORRECT - Sequential operations
const builder = client.initBuilder();
builder.send(...);
builder.send(...);
await client.publishBuilder(builder);
```

### 2. Always Provide Metadata in setInfo
```javascript
// ❌ WRONG - Will fail!
builder.setInfo({
  name: 'My Account',
  description: 'Test'
});

// ✅ CORRECT
builder.setInfo({
  name: 'My Account',
  description: 'Test',
  metadata: Buffer.from(JSON.stringify({ type: 'ACCOUNT' })).toString('base64')
});
```

### 3. Grant Permissions Before Operations
```javascript
// For storage to hold tokens
builder.updatePermissions(
  tokenAccount,
  new KeetaNet.lib.Permissions(['STORAGE_CAN_HOLD']),
  undefined,
  undefined,
  { account: storageAccount }
);

// THEN you can send tokens to storage
builder.send(storageAccount, amount, tokenAccount);
```

### 4. Wait Between Transaction Steps
```javascript
// Step 1
await client.publishBuilder(builder1);

// Wait for network settlement
await new Promise(resolve => setTimeout(resolve, 5000));

// Step 2
await client.publishBuilder(builder2);
```

### 5. Reset Client Between Tests
```javascript
let opsClient = null;

export function resetOpsClient() {
  opsClient = null;  // Clears cached votes
}

export async function getOpsClient() {
  if (!opsClient) {
    const seed = seedFromHex(process.env.OPS_SEED);
    const account = KeetaNet.lib.Account.fromSeed(seed, 0);
    opsClient = KeetaNet.UserClient.fromNetwork('test', account);
  }
  return opsClient;
}
```

---

## 9. Common Errors & Solutions

### "We cannot vote for this block, we have an existing vote for a successor"
**Cause**: DAG fork from concurrent builders or cached witness votes
**Solution**:
- Avoid concurrent builders on same account
- Wait for temporary votes to expire (5 minutes)
- Use `client.sync()` to sync account state
- Reset client between test runs

### "Resulting balance becomes negative"
**Cause**: Insufficient balance for operation
**Solution**: Check balances before operations using `getBalances()`

### "Key metadata for operation is not optional but undefined"
**Cause**: Missing metadata in setInfo
**Solution**: Always provide metadata field (base64-encoded JSON)

### "Permission denied"
**Cause**: Missing required permission
**Solution**: Grant permissions before operations (STORAGE_CAN_HOLD, TOKEN_ADMIN_*, etc.)

---

## 10. AMM Formulas (From Docs)

### Constant Product (x * y = k)
```javascript
const k = reserveA * reserveB;  // Must remain constant
```

### Swap Output (with 0.3% fee)
```javascript
function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000n) + amountInWithFee;
  return numerator / denominator;
}
```

### Initial Liquidity
```javascript
const lpTokens = Math.sqrt(amountA * amountB);
```

### Add Liquidity (Existing Pool)
```javascript
const liquidityA = (amountA * totalLPSupply) / reserveA;
const liquidityB = (amountB * totalLPSupply) / reserveB;
const lpTokens = Math.min(liquidityA, liquidityB);
```

### Remove Liquidity
```javascript
const amountA = (lpTokens * reserveA) / totalLPSupply;
const amountB = (lpTokens * reserveB) / totalLPSupply;
```

### Price Impact
```javascript
function getPriceImpact(amountIn, reserveIn, reserveOut) {
  const priceBefore = reserveOut / reserveIn;
  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
  const priceAfter = (reserveOut - amountOut) / (reserveIn + amountIn);
  return ((priceBefore - priceAfter) / priceBefore) * 100;
}
```

---

## 11. Testnet Resources

### Endpoints
- **RPC**: https://api.test.keeta.com
- **Wallet**: https://wallet.test.keeta.com
- **Explorer**: https://explorer.test.keeta.com
- **Faucet**: https://faucet.test.keeta.com
- **Docs**: https://docs.keeta.com
- **SDK Docs**: https://static.test.keeta.com/docs/

### Environment Setup
```bash
export OPS_SEED="<64-char-hex-seed>"
export NETWORK="test"
export NODE_HTTP="https://api.test.keeta.com"
```

---

## 12. Complete Working Example

```javascript
import * as KeetaNet from '@keetanetwork/keetanet-client';

// Initialize
const seed = Uint8Array.from(Buffer.from(process.env.OPS_SEED, 'hex'));
const opsAccount = KeetaNet.lib.Account.fromSeed(seed, 0);
const client = KeetaNet.UserClient.fromNetwork('test', opsAccount);

// 1. Create Token A
const tokenABuilder = client.initBuilder();
const tokenAPending = tokenABuilder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.TOKEN
);
await tokenABuilder.computeBlocks();
const tokenAAccount = tokenAPending.account;

tokenABuilder.setInfo({
  name: 'Token A',
  description: 'First token',
  metadata: Buffer.from(JSON.stringify({
    symbol: 'TKA',
    decimals: 9
  })).toString('base64'),
  defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'])
}, { account: tokenAAccount });

tokenABuilder.updatePermissions(
  opsAccount,
  new KeetaNet.lib.Permissions(['TOKEN_ADMIN_SUPPLY', 'TOKEN_ADMIN_MODIFY_BALANCE']),
  undefined,
  undefined,
  { account: tokenAAccount }
);

await client.publishBuilder(tokenABuilder);

// 2. Create Token B (similar pattern)
// ... (repeat for Token B)

// 3. Create Pool
const poolBuilder = client.initBuilder();
const poolPending = poolBuilder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.STORAGE
);
await poolBuilder.computeBlocks();
const poolAccount = poolPending.account;

poolBuilder.setInfo({
  name: 'TKA_TKB_POOL',
  description: 'Liquidity Pool',
  metadata: Buffer.from(JSON.stringify({
    type: 'POOL',
    tokenA: tokenAAccount.publicKeyString.toString(),
    tokenB: tokenBAccount.publicKeyString.toString()
  })).toString('base64'),
  defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'])
}, { account: poolAccount });

poolBuilder.updatePermissions(opsAccount, new KeetaNet.lib.Permissions(['OWNER']), undefined, undefined, { account: poolAccount });
poolBuilder.updatePermissions(tokenAAccount, new KeetaNet.lib.Permissions(['STORAGE_CAN_HOLD']), undefined, undefined, { account: poolAccount });
poolBuilder.updatePermissions(tokenBAccount, new KeetaNet.lib.Permissions(['STORAGE_CAN_HOLD']), undefined, undefined, { account: poolAccount });

await client.publishBuilder(poolBuilder);

// 4. Create LP Token
// ... (follow LP token pattern above)

// 5. Add Liquidity
// ... (follow add liquidity flow above)
```

---

## 13. Key Differences: Docs vs Reality

| Concept | Documentation | Actual SDK |
|---------|--------------|------------|
| Client Init | `new KeetaNetClient()` | `KeetaNet.UserClient.fromNetwork()` |
| Token Creation | `client.createToken()` | `builder.generateIdentifier()` + setInfo |
| Minting | `client.mintTokens()` | `modifyTokenSupply()` + `modifyTokenBalance()` |
| Transfer | `client.sendTransaction()` | `builder.send()` |
| Atomic Swaps | `client.executeSwap()` | Custom implementation using send() |

**Conclusion**: Documentation shows HIGH-LEVEL concepts. Real SDK is LOW-LEVEL builder pattern.

---

## 14. Production Checklist

- [ ] Thorough testnet testing
- [ ] Security audit of pool logic
- [ ] Frontend integration
- [ ] Slippage protection
- [ ] Deadline checks
- [ ] Error handling & recovery
- [ ] Monitor DAG conflicts
- [ ] Gas optimization
- [ ] Permission validation
- [ ] Edge case testing (zero amounts, rounding, etc.)

---

This guide combines theoretical concepts from documentation with ACTUAL working patterns from the real Keeta SDK. Use the "Actual SDK" patterns for implementation, and the docs for understanding high-level concepts.
