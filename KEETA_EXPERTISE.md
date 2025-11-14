# Keeta Network Development Expertise

## Executive Summary

Keeta Network is a high-performance Layer-1 blockchain achieving 10M+ TPS with 400ms settlement times through a unique hybrid DAG architecture, Google Spanner backend, and innovative consensus mechanism.

---

## 1. Core Architecture

### 1.1 Hybrid DAG Design
- **Per-Account Chains**: Each account maintains its own DAG chain
- **Block Structure**: Collections of operations identified by hash (excluding signature)
- **Atomic Transactions**: Vote staples bundle blocks + votes for atomic execution
- **No Global Blockchain**: Eliminates mempool and traditional block propagation delays

### 1.2 Consensus Mechanism (Enhanced DPoS)
**Two-Phase Voting:**
1. **Temporary Votes** (5-minute validity)
   - Representatives issue based on current block validity
   - Establish primary consensus and determine quorum
   - Can be cached by witness nodes
   - Used for initial validation

2. **Permanent Votes** (immutable)
   - Requested after temporary vote quorum achieved
   - Only issued by subset who provided temporary votes
   - Prevent premature approval
   - Tradeable from temporary votes

**Vote Staples:**
- Bundle of votes + referenced blocks
- Transaction unit in KeetaNet
- All blocks applied atomically
- X.509 certificate-based notarization

### 1.3 Performance Architecture
- **Google Spanner Backend**: Distributed SQL database for ledger storage
- **Client-Directed Validation**: Clients collect votes before submission
- **Hardware Separation**: Representatives vs participants (view-only)
- **Pruning**: Nodes can prune old ledger history
- **11M TPS Verified**: Public stress test results

---

## 2. Account System

### 2.1 Account Types

**Key Pair Accounts:**
- Hold private keys (internal or external via ExternalKeyPair)
- Can sign operations
- Derived from seed + index

**Identifier Accounts:**
- Represent specific address types
- Created via `generateIdentifier()`
- Types: TOKEN, NETWORK_ADDRESS, STORAGE

**Network Address:**
- Special account derived from network identifier
- Defines network-wide permissions

**Storage Accounts:**
- Hold assets (tokens)
- Require STORAGE_CAN_HOLD permission for tokens
- Can be single-token or multi-token

**Token Accounts:**
- Represent fungible assets
- Native tokenization support
- Supply modification via modifyTokenSupply

### 2.2 Account Creation Patterns

```typescript
// From seed (key pair)
const account = KeetaNet.lib.Account.fromSeed(seed, index);

// Generate identifier (storage/token)
const builder = client.initBuilder();
const pending = builder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.TOKEN
);
await builder.computeBlocks();
const account = pending.account;
```

---

## 3. Operations & Effects

### 3.1 Core Operations

**setInfo:**
- Set account name, description, metadata
- Metadata REQUIRED (base64 encoded JSON)
- Set defaultPermission for account

**updatePermissions:**
- Grant/revoke permissions to principals
- Target account specifies which account's permissions to modify
- Method: ADD, REMOVE, or REPLACE

**send:**
- Transfer tokens between accounts
- Decrement sender, increment receiver
- Atomic operation

**modifyTokenSupply:**
- Mint (increase) or burn (decrease) token supply
- Requires TOKEN_ADMIN_SUPPLY permission
- Used for LP token mint/burn

**modifyTokenBalance:**
- Directly adjust account balance
- Requires TOKEN_ADMIN_MODIFY_BALANCE permission
- Alternative to send for token admins

---

## 4. Permissions Model

### 4.1 Base Permissions (Network-Enforced)

| Permission | Purpose |
|------------|---------|
| ACCESS | Basic resource access |
| ADMIN | All actions except delete/transfer ownership |
| OWNER | Full control including delete/transfer |
| UPDATE_INFO | Modify account metadata |
| STORAGE_CREATE | Create storage accounts |
| TOKEN_ADMIN_CREATE | Create tokens |
| TOKEN_ADMIN_SUPPLY | Mint/burn token supply |
| TOKEN_ADMIN_MODIFY_BALANCE | Directly modify balances |
| STORAGE_DEPOSIT | Deposit to storage |
| STORAGE_CAN_HOLD | Token can be held in storage |
| SEND_ON_BEHALF | Send from another account |
| PERMISSION_DELEGATE_ADD/REMOVE | Delegate permissions |
| MANAGE_CERTIFICATE | X.509 certificate management |

### 4.2 Permission Inheritance
- Creator automatically receives OWNER permission
- defaultPermission applies to all accounts by default
- Specific grants override defaults

---

## 5. Builder Pattern & Transaction Flow

### 5.1 UserClientBuilder (Recommended)

```typescript
// Initialize builder
const builder = client.initBuilder();

// Builder handles:
// - Correct network ID
// - Previous block hash (account chain continuity)
// - Block computation
// - Signature generation

// Add operations
builder.setInfo({ name, description, metadata }, { account });
builder.send(recipient, amount, token);
builder.updatePermissions(principal, permissions, target);

// Publish (submits to network)
await client.publishBuilder(builder);
```

### 5.2 Transaction Lifecycle

1. **Build**: Create operations via builder
2. **Compute**: `computeBlocks()` generates block hashes
3. **Sign**: Builder signs blocks
4. **Request Votes**: Client requests temporary votes from representatives
5. **Quorum**: Achieve temporary vote quorum
6. **Permanent Votes**: Request permanent votes from quorum subset
7. **Vote Staple**: Bundle blocks + permanent votes
8. **Broadcast**: Submit vote staple to network
9. **Finalization**: Representatives apply to ledger

---

## 6. Token Operations

### 6.1 Token Creation

```typescript
// Generate token account
const builder = client.initBuilder();
const pending = builder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.TOKEN
);
await builder.computeBlocks();
const tokenAccount = pending.account;

// Set token info
builder.setInfo({
  name: 'MY_TOKEN',
  description: 'My Token Description',
  metadata: Buffer.from(JSON.stringify({
    symbol: 'MTK',
    decimals: 9,
    type: 'TOKEN'
  })).toString('base64'),
  defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'])
}, { account: tokenAccount });

// Grant creator admin permissions
builder.updatePermissions(
  creatorAccount,
  new KeetaNet.lib.Permissions(['TOKEN_ADMIN_SUPPLY', 'TOKEN_ADMIN_MODIFY_BALANCE']),
  undefined,
  undefined,
  { account: tokenAccount }
);

await client.publishBuilder(builder);
```

### 6.2 Minting & Burning

```typescript
// Mint tokens (increase supply)
const builder = client.initBuilder();
builder.modifyTokenSupply(
  tokenAccount,
  amount,  // positive for mint
  { account: tokenAccount }
);

// Credit to recipient
builder.modifyTokenBalance(
  recipientAccount,
  tokenAccount,
  amount,
  { account: tokenAccount }
);

await client.publishBuilder(builder);

// Burn tokens (decrease supply)
builder.modifyTokenSupply(
  tokenAccount,
  -amount,  // negative for burn
  { account: tokenAccount }
);
```

---

## 7. Best Practices

### 7.1 Always Use UserClientBuilder
- Handles network ID automatically
- Manages previous block hash (critical for DAG)
- Prevents fork conflicts
- **Never use raw BlockBuilder**

### 7.2 Sequential Operations on Same Account
```typescript
// ❌ WRONG: Concurrent builders for same account
const builder1 = client.initBuilder();
const builder2 = client.initBuilder(); // Creates fork!

// ✅ CORRECT: Single builder, sequential operations
const builder = client.initBuilder();
builder.send(alice, 100, token);
builder.send(bob, 200, token);
await client.publishBuilder(builder);
```

### 7.3 Metadata Always Required
```typescript
// setInfo REQUIRES metadata (not optional)
builder.setInfo({
  name: 'Account Name',
  description: 'Description',
  metadata: Buffer.from(JSON.stringify({ /*data*/ })).toString('base64'), // REQUIRED!
  defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'])
});
```

### 7.4 Grant Permissions Before Use
```typescript
// For storage to hold tokens
builder.updatePermissions(
  tokenAccount,
  new KeetaNet.lib.Permissions(['STORAGE_CAN_HOLD', 'ACCESS']),
  undefined,
  undefined,
  { account: storageAccount }
);
```

---

## 8. Error Handling & Recovery

### 8.1 Common Errors

**"We cannot vote for this block, we have an existing vote for a successor"**
- **Cause**: DAG fork - trying to build on old blocks while witnesses voted for newer blocks
- **Solution**:
  - Wait for temporary votes to expire (5 minutes)
  - Use `UserClient.sync()` to sync account state
  - Avoid concurrent builders on same account
  - Use `UserClient.recover()` for side ledger recovery

**"Resulting balance becomes negative"**
- **Cause**: Insufficient balance for operation
- **Solution**: Check balances before operations

**"Key metadata for operation is not optional but undefined"**
- **Cause**: Missing required metadata in setInfo
- **Solution**: Always provide metadata field

### 8.2 Query & Sync Methods

```typescript
// Sync account to latest state
await client.sync();

// Query account info
const accountInfo = await client.client.getAccountsInfo([address]);

// Get pending blocks
const pending = await client.pendingBlock();

// Recover from side ledger
await client.recover();
```

---

## 9. DEX Implementation Patterns

### 9.1 Pool Account Setup

```typescript
// Create pool storage account
const poolBuilder = client.initBuilder();
const poolPending = poolBuilder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.STORAGE
);
await poolBuilder.computeBlocks();
const poolAccount = poolPending.account;

// Set pool info with metadata
poolBuilder.setInfo({
  name: 'TOKEN_A_TOKEN_B_POOL',
  description: 'Liquidity Pool',
  metadata: Buffer.from(JSON.stringify({
    type: 'POOL',
    tokenA: 'keeta_...',
    tokenB: 'keeta_...',
    createdAt: Date.now()
  })).toString('base64'),
  defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'])
}, { account: poolAccount });

// Grant OWNER to pool operator
poolBuilder.updatePermissions(
  operatorAccount,
  new KeetaNet.lib.Permissions(['OWNER']),
  undefined,
  undefined,
  { account: poolAccount }
);

// Allow tokens to be held in pool
poolBuilder.updatePermissions(
  tokenAAccount,
  new KeetaNet.lib.Permissions(['STORAGE_CAN_HOLD', 'ACCESS']),
  undefined,
  undefined,
  { account: poolAccount }
);

await client.publishBuilder(poolBuilder);
```

### 9.2 LP Token Pattern

```typescript
// Create LP token
const lpBuilder = client.initBuilder();
const lpPending = lpBuilder.generateIdentifier(
  KeetaNet.lib.Account.AccountKeyAlgorithm.TOKEN
);
await lpBuilder.computeBlocks();
const lpTokenAccount = lpPending.account;

// LP token info
lpBuilder.setInfo({
  name: 'TOKEN_A_TOKEN_B_LP',
  description: 'Liquidity Provider token',
  metadata: Buffer.from(JSON.stringify({
    symbol: 'A-B-LP',
    decimals: 9,
    type: 'LP_TOKEN',
    pool: poolAddress
  })).toString('base64'),
  defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'])
}, { account: lpTokenAccount });

// Grant pool admin permissions
lpBuilder.updatePermissions(
  poolAccount,
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

### 9.3 Add Liquidity Flow

```typescript
// 1. User sends tokens to pool
const addBuilder = client.initBuilder();
addBuilder.send(poolAccount, amountA, tokenA);
addBuilder.send(poolAccount, amountB, tokenB);
await client.publishBuilder(addBuilder);

// 2. Pool mints LP tokens to user
const mintBuilder = client.initBuilder();

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

### 9.4 Remove Liquidity Flow

```typescript
// 1. Burn LP tokens from user
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

// 2. Return tokens from pool to user
const returnBuilder = client.initBuilder();
returnBuilder.send(
  userAccount,
  amountA,
  tokenA,
  undefined,
  { account: poolAccount } // SEND_ON_BEHALF permission required
);
returnBuilder.send(
  userAccount,
  amountB,
  tokenB,
  undefined,
  { account: poolAccount }
);

await client.publishBuilder(returnBuilder);
```

---

## 10. Advanced Concepts

### 10.1 Side Ledger
- Parallel ledger for incomplete consensus rounds
- Query via `Client.getVoteStaple(hash, 'side')`
- Recover via `UserClient.recover()`

### 10.2 Delegation
- Accounts delegate balance to representatives
- Grants voting power proportional to delegated balance
- Core of DPoS consensus

### 10.3 Certificates
- X.509 certificates for identity
- Managed via MANAGE_CERTIFICATE permission
- Used in vote staple notarization

---

## 11. Reference Information

### 11.1 Key Addresses (Testnet)

- **Network**: test
- **RPC**: https://api.test.keeta.com
- **Explorer**: https://explorer.test.keeta.com

### 11.2 Token Decimals
- Most tokens use 9 decimals
- Always query metadata to confirm
- Use BigInt for precision

### 11.3 Address Format
- Prefix: `keeta_`
- Format: `keeta_` + base32 encoded public key
- Example: `keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52`

---

## 12. Development Workflow

### 12.1 Setup
```bash
npm install @keetanetwork/keetanet-client
```

### 12.2 Environment
```bash
export OPS_SEED="<64-char hex seed>"
export NETWORK="test"
export NODE_HTTP="https://api.test.keeta.com"
```

### 12.3 Testing Pattern
```typescript
// Always reset client between tests to avoid caching
let client = null;
export function resetClient() {
  client = null;
}

export async function getClient() {
  if (!client) {
    const seed = seedFromHex(process.env.OPS_SEED);
    const account = KeetaNet.lib.Account.fromSeed(seed, 0);
    client = KeetaNet.UserClient.fromNetwork('test', account);
  }
  return client;
}
```

---

## 13. Conclusion

Keeta Network's unique architecture enables unprecedented performance while maintaining decentralization. Key to success:
1. Use UserClientBuilder exclusively
2. Never create concurrent builders for same account
3. Always provide metadata in setInfo
4. Grant permissions before operations
5. Handle temporary vote expiration gracefully

This expertise enables building production-ready DeFi applications on Keeta's high-performance infrastructure.

