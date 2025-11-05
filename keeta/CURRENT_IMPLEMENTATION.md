# Keeta DEX - Current Implementation

## Overview

This document describes **how the Keeta DEX currently works** and what trust assumptions users must understand. This is an **interim solution** while we wait for Keeta to add smart contract support.

---

## Architecture Decision

### The Challenge

Keeta blockchain currently does **NOT support smart contracts**. This means we cannot deploy on-chain AMM logic like Uniswap's contracts.

### Our Solution: Single User-Owned Pool Per Pair (Current Implementation)

```
One Pool Per Pair (Creator-Owned):
├── First user creates RIDE/WAVE pool → They own it exclusively
├── Pool is registered, no duplicate RIDE/WAVE pools allowed
├── Creator provides ALL liquidity and maintains full custody
├── OPS granted SEND_ON_BEHALF permission to route swaps
├── Swaps route through this single pool (simple, no aggregation)
├── Creator earns 100% of all swap fees for that pair
└── Other users wanting liquidity → must create different pairs

✅ Pros:
   - User maintains full custody (self-custodial!)
   - Simple routing (one pool per pair)
   - No trust needed for funds custody
   - Creator earns all fees from their pair
   - No complex aggregation logic

❌ Cons:
   - Only creator can provide liquidity for that pair
   - Liquidity limited to creator's capital
   - "First come, first served" pool creation
   - Other users cannot add to existing pools
```

**This is a unique "Pool Operator" model** - more like running your own market maker than traditional LP. You maintain custody while OPS routes swaps through your pool.

---

## How It Works

### Pool Creation

**When a user creates a pool:**

```javascript
1. User requests: "Create RIDE/WAVE pool"
   ↓
2. OPS creates STORAGE account on Keeta blockchain
   ↓
3. OPS transfers ownership to the user (creator owns their pool!)
   ↓
4. User's pool grants SEND_ON_BEHALF permission to OPS for routing
   ↓
5. Pool is registered in .pools.json with owner address
   ↓
6. Pool is ready for the owner to add their liquidity
```

**Key Point:** The pool is **owned by the creator**, not by OPS. This means users maintain custody of their liquidity. Each user who wants to provide liquidity creates their own pool.

---

### Adding Liquidity

**When a user adds liquidity to THEIR pool:**

```javascript
1. User deposits: 100 RIDE + 200 WAVE
   ↓
2. User signs transaction with their wallet
   ↓
3. Tokens transfer to USER-owned pool (on-chain)
   ↓
4. Backend tracks the deposit amount (for routing calculations)
   ↓
5. User maintains full custody - they own the pool account
```

**On-Chain (Verifiable):**
- ✅ Pool receives tokens (visible on blockchain)
- ✅ Pool is owned by user (verifiable)
- ✅ User's wallet balance decreases
- ✅ Transaction is immutable
- ✅ User can withdraw at any time (they own it!)

**Self-Custodial Model:**
- ✅ User owns the pool STORAGE account
- ✅ User controls their liquidity directly
- ✅ No trust needed for custody
- ✅ OPS can only route swaps (SEND_ON_BEHALF permission)

---

### Swapping

**When a user swaps tokens:**

```javascript
1. User wants: 10 RIDE → ?? WAVE
   ↓
2. Backend finds THE RIDE/WAVE pool (one pool per pair)
   ↓
3. Backend calculates: 8.5 WAVE (minus 0.3% fee)
   ↓
4. User signs atomic transaction
   ↓
5. Atomic execution on Keeta blockchain:
   - User sends 0.03 RIDE to treasury (fee)
   - User sends 10 RIDE to pool owner's pool
   - OPS uses SEND_ON_BEHALF to route 8.5 WAVE from pool to user
   ↓
6. All operations succeed atomically (or all fail)
```

**Key Features:**
- **Atomic swaps** - All operations succeed or all fail
- **Simple routing** - One pool per pair, no aggregation needed
- **Self-custodial** - Pool owner maintains custody throughout
- **Fee to owner** - Pool owner earns the 0.3% swap fee

---

### Removing Liquidity

**When a user removes liquidity:**

```javascript
1. User requests: "Remove 50% of my position"
   ↓
2. Backend calculates tokens owed (from LP share %)
   ↓
3. User signs transaction
   ↓
4. OPS uses SEND_ON_BEHALF to send tokens from pool to user
   ↓
5. Backend updates .liquidity-positions-*.json
   ↓
6. User receives tokens back (including earned fees)
```

---

## What's On-Chain vs Off-Chain

### ✅ On-Chain (Trustless & Verifiable)

| Data | Location | How to Verify |
|------|----------|---------------|
| **Pool tokens** | Pool STORAGE account | Query balance via Keeta API |
| **Token transfers** | Transaction history | View on Keeta explorer |
| **Atomic swaps** | Vote staples | All operations visible |
| **Pool ownership** | Account metadata | Check account owner |
| **OPS permissions** | Pool ACLs | Query granted permissions |

**Example Verification:**
```javascript
// Check pool's token balance
const client = UserClient.fromNetwork('test', null);
const balances = await client.client.getAllBalances(poolAddress);
// Returns: actual token amounts in pool
```

### ❌ Off-Chain (Requires Trust)

| Data | Location | Trust Assumption |
|------|----------|------------------|
| **Pool registry** | `.pools.json` | Trust backend lists all pools |
| **LP positions** | `.liquidity-positions-*.json` | Trust backend tracks shares correctly |
| **LP share %** | Calculated by backend | Trust AMM math is correct |
| **Price quotes** | Backend calculation | Trust constant product formula |

**What This Means:**
- Backend could display incorrect LP shares
- Backend could miscalculate swap amounts
- If JSON files are lost, LP positions could be disputed
- Users must trust OPS operator (you)

---

## Trust Model

### What Users MUST Trust

**1. Backend Calculations**
```
User trusts:
├── Constant product formula is applied correctly
├── LP shares are calculated accurately
├── Fee distribution (0.3%) is honest
└── Slippage calculations are correct
```

**2. LP Position Tracking**
```
User trusts:
├── .json files are backed up regularly
├── LP shares won't be manipulated
├── Withdrawal amounts are calculated fairly
└── Backend won't claim more than it should
```

**3. Backend Availability**
```
User trusts:
├── Server stays online for swaps
├── No data loss
└── API endpoints remain accessible
```

### What Users DON'T Need to Trust

**1. Token Custody During Swaps** ✅
```
Users do NOT trust OPS to hold tokens during swaps:
├── User signs every transaction
├── Tokens only move when user approves
├── Atomic execution (all-or-nothing)
└── OPS cannot steal tokens mid-swap
```

**2. Pool Token Holdings** ✅
```
Users do NOT trust OPS about pool balances:
├── Pool balances are on-chain
├── Anyone can verify reserves
├── Blockchain ensures token conservation
└── OPS cannot create fake tokens
```

**3. Transaction Validity** ✅
```
Users do NOT trust OPS to validate transactions:
├── Keeta validators enforce consensus
├── Vote staples ensure atomicity
├── Network rejects invalid operations
└── Immutable transaction history
```

---

## Security Guarantees

### Atomic Swaps

**All swap operations are atomic:**
```javascript
Transaction = [
  userToTreasury(feeAmount),      // Step 1
  userToPool(amountIn),            // Step 2
  poolToUser(amountOut)            // Step 3
]

If ANY step fails → ALL steps revert
If ALL steps succeed → Transaction finalized
```

**User Protection:**
- No tokens lost if swap fails
- No partial swaps
- Slippage protection enforced

### Permission Model

**OPS has limited permissions:**
```
OPS can:
├── ✅ Send tokens from pool via SEND_ON_BEHALF
└── ✅ Only when executing user-signed transactions

OPS cannot:
├── ❌ Withdraw pool tokens arbitrarily
├── ❌ Execute transactions without user signature
└── ❌ Steal user wallet tokens
```

### User Signatures Required

**Every operation requires user approval:**
```
No Transaction Without User Signature:
├── Swaps → User must sign
├── Add liquidity → User must sign
├── Remove liquidity → User must sign
└── OPS cannot act without explicit approval
```

---

## Current Limitations

### 1. LP Position Tracking (Off-Chain)

**Issue:** LP shares stored in JSON files, not on-chain

**Impact:**
- If files are lost, disputes about LP ownership
- No on-chain proof of LP token holdings
- Requires trusting backend records

**Mitigation:**
- Regular automated backups
- Future migration to database (PostgreSQL)
- When smart contracts available: on-chain LP tokens

---

### 2. Single Pool Per Pair

**Issue:** Only one pool per token pair (e.g., one RIDE/WAVE pool)

**Impact:**
- If you want separate liquidity, you can't create your own pool
- All liquidity is shared in one pool
- No competition between pool operators

**Why This Design:**
- Avoids fragmented liquidity
- Simpler routing (direct swaps only)
- Better price consistency
- Easier for users to understand

**Trade-off:** Less decentralized than user-owned pools, but much simpler UX

---

### 3. Backend Dependency

**Issue:** DEX requires backend server to be running

**Impact:**
- If server goes down, no swaps possible
- LP positions stored locally on server
- Users can't interact with pools directly

**Mitigation:**
- Production deployment with monitoring
- Automatic restart on failure
- Database backup strategy
- Future: Multiple backend instances

---

### 4. No Composability

**Issue:** Other protocols cannot interact with Keeta DEX programmatically

**Impact:**
- Can't build on top of our pools
- No flash loans
- No complex DeFi strategies
- Limited to direct user interaction

**When Fixed:** When Keeta adds smart contracts, full composability possible

---

## Operational Procedures

### Pool Creation Protocol

**Who Can Create Pools:**
- Anyone (permissionless)
- Creator does NOT own the pool
- OPS owns all pools

**Process:**
1. User submits pool creation request (tokenA, tokenB)
2. Backend validates: tokens exist, no duplicate pool
3. OPS creates STORAGE account on Keeta blockchain
4. OPS grants itself SEND_ON_BEHALF permission
5. Pool registered in `.pools.json`
6. Pool immediately available for liquidity

**Constraints:**
- Only ONE pool per token pair
- Cannot create duplicate pools
- Pool names follow format: `SILVERBACK_POOL_A`, `SILVERBACK_POOL_B`, etc.

---

### Liquidity Management Protocol

**Adding Liquidity:**
```
1. User specifies amounts (amountA, amountB)
2. Backend calculates optimal ratio (based on current reserves)
3. User approves transaction
4. Tokens transfer to pool (on-chain)
5. Backend calculates LP shares:

   If first LP:
     shares = sqrt(amountA * amountB)

   If existing LPs:
     shares = min(
       amountA / reserveA * totalShares,
       amountB / reserveB * totalShares
     )

6. Backend saves LP position to JSON file
7. User's position tracked with:
   - shares (BigInt)
   - amountA deposited (BigInt)
   - amountB deposited (BigInt)
```

**Removing Liquidity:**
```
1. User specifies % to remove (or LP share amount)
2. Backend calculates tokens owed:

   amountA = (shares / totalShares) * reserveA
   amountB = (shares / totalShares) * reserveB

3. User approves transaction
4. OPS uses SEND_ON_BEHALF to send tokens from pool
5. Backend updates LP position (reduces shares)
6. If shares = 0, remove position from file
```

---

### Swap Execution Protocol

**Quote Calculation:**
```javascript
// Constant product formula (Uniswap V2)
function getAmountOut(amountIn, reserveIn, reserveOut) {
  const feeMultiplier = 997; // 0.3% fee
  const amountInWithFee = amountIn * feeMultiplier;
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000) + amountInWithFee;
  return numerator / denominator;
}
```

**Transaction Construction:**
```
1. User requests quote
2. Backend calculates amountOut
3. User sets slippage tolerance (default 0.5%)
4. Backend calculates minAmountOut:

   minAmountOut = amountOut * (1 - slippageTolerance)

5. User approves transaction
6. Atomic execution:
   a. User sends feeAmount to treasury
   b. User sends amountIn to pool
   c. OPS sends amountOut from pool to user (via SEND_ON_BEHALF)

7. If amountOut < minAmountOut → transaction fails
8. Update pool reserves cache
```

**Fee Distribution:**
- 0.3% of each swap → Stays in pool reserves
- Automatically distributed to LPs via increased reserves
- No explicit fee claim needed (fees compound)

---

### Backup & Recovery Protocol

**Data That Must Be Backed Up:**
```
Critical Files:
├── .pools.json (pool registry)
├── .liquidity-positions-*.json (all LP positions)
└── .env (OPS seed - EXTREMELY SENSITIVE)
```

**Backup Strategy:**
```
Automated Backups:
├── Hourly: Copy JSON files to backup directory
├── Daily: Upload to cloud storage (encrypted)
├── Weekly: Full system snapshot
└── After every pool creation or liquidity change
```

**Recovery Procedure:**
```
If Backend Server Crashes:

1. Restore .pools.json from backup
   → Pool registry recovered

2. Restore .liquidity-positions-*.json files
   → LP positions recovered

3. Query Keeta blockchain for pool balances
   → Verify reserves match expectations

4. Restart backend server
   → Pools reload from files

5. Validate:
   - All pools appear in UI
   - All LP positions visible
   - Reserves match on-chain balances
```

**Data Verification:**
```javascript
// After recovery, verify pool state
const onChainBalance = await queryBlockchain(poolAddress, tokenA);
const trackedBalance = pool.reserveA;

if (onChainBalance !== trackedBalance) {
  console.error('MISMATCH: On-chain vs tracked reserves!');
  // Manual reconciliation needed
}
```

---

## Migration Path to Smart Contracts

**When Keeta Adds Smart Contract Support:**

### Phase 1: Deploy Smart Contracts
```
1. Deploy Pool Factory contract
2. Deploy Router contract
3. Deploy LP Token contracts (ERC20-like)
4. Test on testnet
```

### Phase 2: Migrate Pools
```
For each existing pool:

1. Create on-chain pool contract
2. Transfer tokens from OPS-owned STORAGE to contract
3. Mint LP tokens for existing LPs (based on .json records)
4. Distribute LP tokens to users
5. Deprecate off-chain pool
```

### Phase 3: Migrate Frontend
```
1. Update frontend to call smart contracts
2. Remove backend dependencies for swaps
3. LP positions now read from on-chain LP tokens
4. Backend becomes optional (just for UI/indexing)
```

### Phase 4: Full Decentralization
```
✅ Pools are smart contracts
✅ LP tokens are on-chain
✅ AMM logic executed by validators
✅ No trust in backend operator required
✅ Fully composable with other protocols
```

---

## User Guidelines

### For Liquidity Providers

**Before Adding Liquidity:**
- ✅ Understand impermanent loss
- ✅ Know that LP shares are tracked off-chain
- ✅ Verify pool reserves on-chain
- ✅ Start with small amounts to test
- ✅ Backup your wallet seed phrase

**While Providing Liquidity:**
- ✅ Check your LP position regularly (Portfolio tab)
- ✅ Monitor fee earnings (visible in reserve growth)
- ✅ Understand you're trusting OPS for LP accounting

**When Removing Liquidity:**
- ✅ Verify calculated amounts look correct
- ✅ Check you receive expected tokens
- ✅ Confirm transaction on Keeta explorer

---

### For Traders

**Before Swapping:**
- ✅ Check the exchange rate
- ✅ Review slippage tolerance
- ✅ Verify you have enough tokens for fees
- ✅ Start with small test swaps

**When Swapping:**
- ✅ Sign transaction in your wallet
- ✅ Wait for blockchain confirmation
- ✅ Verify you received correct amount
- ✅ Transaction is on Keeta explorer

**If Swap Fails:**
- ✅ Check slippage tolerance (may need to increase)
- ✅ Verify you have sufficient balance
- ✅ Check network status
- ✅ Try smaller swap amount

---

## Transparency Commitments

### Open Source
- ✅ All backend code available for audit
- ✅ AMM formulas are standard (Uniswap V2)
- ✅ Frontend code open for inspection

### Verifiability
- ✅ All swaps recorded on Keeta blockchain
- ✅ Pool balances publicly queryable
- ✅ Transaction history immutable

### Documentation
- ✅ Clear explanation of trust assumptions
- ✅ Honest about limitations
- ✅ Roadmap for full decentralization

---

## FAQ

**Q: Why doesn't each user own their pool?**
A: We chose shared pools for simplicity. User-owned pools would fragment liquidity and require complex routing. When smart contracts are available, users can create their own pools if desired.

**Q: What if the backend crashes?**
A: Your tokens are safe on-chain. The backend can be restored from backups. Your LP position would be recovered from `.liquidity-positions-*.json` files.

**Q: Can OPS steal my liquidity?**
A: **Technical answer:** Yes, OPS could use SEND_ON_BEHALF to withdraw from pools. **Practical answer:** This would be immediately visible on-chain and destroy trust. All operations are logged immutably.

**Q: Why should I trust this?**
A: You shouldn't blindly trust. Instead:
- Verify pool balances on-chain
- Start with small amounts
- Check transaction history
- Understand this is an interim solution
- Know that full decentralization requires smart contracts

**Q: When will smart contracts be available?**
A: We don't control Keeta's roadmap. When they add smart contracts, we'll migrate immediately. Until then, this is the best possible DEX architecture for Keeta.

---

## Contact

**For Technical Questions:**
- Review source code: `/server/keeta-impl/`
- Check API docs: `/keeta/docs/`

**For Security Concerns:**
- Report vulnerabilities responsibly
- Never share private keys in support requests

---

## Disclaimer

**This is experimental software in active development.**

**Use at your own risk:**
- ⚠️ Backend server dependency
- ⚠️ Off-chain LP tracking
- ⚠️ Trust in OPS operator
- ⚠️ Possible bugs or data loss
- ⚠️ Impermanent loss for LPs

**Only use funds you can afford to lose.**

**By using this DEX, you acknowledge:**
- You understand the trust assumptions
- You accept the risks
- You have verified pool balances independently
- You will not hold the operator liable for losses

---

*Last Updated: 2025-11-05*
*Implementation Version: 1.0 (OPS-Owned Shared Pools)*
