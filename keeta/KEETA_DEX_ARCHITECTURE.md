# Keeta DEX Architecture & Current Status

## Overview

The Keeta DEX is a **hybrid decentralized exchange** that combines on-chain token settlement with off-chain AMM logic. This document explains how it works, why it's built this way, and what trust assumptions users should understand.

## Current Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React)                                       │
│  - User interface                                       │
│  - Wallet connection                                    │
│  - Transaction signing                                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ API Calls
                       ↓
┌─────────────────────────────────────────────────────────┐
│  Backend Server (Node.js + Express)                     │
│  - Pool Registry (one pool per pair)                    │
│  - AMM Calculations (constant product formula)          │
│  - Simple routing (direct swaps only)                   │
│  - Transaction Orchestration                            │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Keeta SDK
                       ↓
┌─────────────────────────────────────────────────────────┐
│  Keeta Blockchain                                       │
│  - User-owned pool storage accounts (self-custody!)     │
│  - Token transfers (SEND operations)                    │
│  - Atomic transactions (vote staples)                   │
│  - Permission system (SEND_ON_BEHALF for routing)       │
└─────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Frontend (Fully Decentralized)
- **Location:** User's browser
- **Trust:** None required - users control their private keys
- **Function:**
  - Display pool information
  - Sign transactions with user's wallet
  - Submit transactions to Keeta blockchain

#### 2. Backend Server (Routing & Calculation Only)
- **Location:** Hosted server (currently development, will be production VPS)
- **Trust:** Users trust the backend to:
  - Calculate swap amounts correctly (AMM math)
  - Find the correct pool for each pair
  - Construct transactions properly
- **Function:**
  - Maintain pool registry (`.pools.json` - one pool per pair)
  - Calculate AMM math (reserves, prices, slippage)
  - Route swaps through user-owned pools
  - Construct atomic swap transactions
- **Does NOT control:** User funds (pools are user-owned)

#### 3. Keeta Blockchain (Fully Decentralized)
- **Location:** Keeta network validators
- **Trust:** Standard blockchain trust model
- **Function:**
  - Execute token transfers
  - Enforce atomic transactions
  - Store actual tokens in pool accounts
  - Validate all operations via consensus

---

## How Swaps Work

### Step-by-Step Swap Flow

```
User wants to swap 10 RIDE → ?? WAVE
```

**1. User Request**
```
Frontend → Backend: "How much WAVE for 10 RIDE in pool XYZ?"
```

**2. Backend Calculation**
```javascript
// Backend reads pool state from .pools.json
const pool = poolManager.getPool('RIDE', 'WAVE');
const reserves = await pool.getReserves(); // Queries blockchain

// Constant product formula: x * y = k
const amountOut = calculateAmountOut(10, reserves.RIDE, reserves.WAVE);
// Result: 8.5 WAVE (minus 0.3% fee)
```

**3. Backend Response**
```
Backend → Frontend: "You'll receive 8.5 WAVE"
```

**4. User Signs Transaction**
```
Frontend: User clicks "Swap" and signs with their wallet
```

**5. Backend Constructs Atomic Transaction**
```javascript
// Backend builds multi-operation transaction
const builder = userClient.initBuilder();

// Operation 1: User sends 0.03 RIDE to treasury (fee)
builder.send(treasury, 0.03, 'RIDE');

// Operation 2: User sends 10 RIDE to pool
builder.send(poolAccount, 10, 'RIDE');

// Operation 3: Pool sends 8.5 WAVE to user
// (Using SEND_ON_BEHALF permission granted to ops account)
builder.send(userAccount, 8.5, 'WAVE', undefined, {
  account: poolAccount
});

// Publish as atomic transaction
await userClient.publishBuilder(builder);
```

**6. Blockchain Execution**
```
Keeta validators verify and execute all operations atomically:
- All 3 operations succeed, OR
- All 3 operations fail (transaction reverts)

Result: User has 8.5 WAVE, pool has 10 more RIDE
```

---

## What's On-Chain vs. Off-Chain

### ✅ Stored On-Chain (Trustless)

| Data | Location | Verifiable |
|------|----------|-----------|
| **Token balances** | Pool STORAGE accounts | ✅ Query any time |
| **Token transfers** | Transaction history | ✅ Immutable ledger |
| **Permissions** | Pool account ACLs | ✅ Public permissions |
| **Atomic execution** | Vote staples | ✅ All-or-nothing |

**Example:** You can verify a pool's token holdings:
```bash
# Check pool's RIDE balance
keeta-cli balance keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek RIDE

# Check pool's WAVE balance
keeta-cli balance keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek WAVE
```

### ❌ Stored Off-Chain (Requires Trust)

| Data | Location | Trust Required |
|------|----------|---------------|
| **Pool registry** | `.pools.json` on server | ⚠️ Trust backend lists correct pool |
| **Pool ownership** | Stored with pool record | ⚠️ Trust backend shows correct owner |
| **Reserves tracking** | Cached in memory | ⚠️ Trust backend (but verifiable on-chain) |
| **AMM calculations** | Backend logic | ⚠️ Trust backend math is correct |

**Why this matters:**
- Backend could display incorrect pool information
- Backend could miscalculate swap amounts
- Backend could hide pools from listing

**But users maintain custody:**
- ✅ Pool owners control their funds directly
- ✅ Can withdraw from their pool anytime (they own it)
- ✅ OPS cannot steal pool owner's liquidity

---

## Trust Model & Security

### What Users Must Trust

**1. Backend Calculations Are Correct**
- The constant product formula is applied correctly
- Slippage calculations are accurate
- Fee calculations (0.3%) are honest

**2. Pool Routing**
- Backend routes to the correct pool for each pair
- Backend doesn't hide pools from listing
- Pool ownership information is accurate

**3. Backend Availability**
- Server stays online for swaps to work
- Pool registry isn't lost
- API endpoints remain accessible

**Note:** Unlike traditional AMMs, pool owners DON'T need to trust custody - they own their pools directly!

### What Users DON'T Need to Trust

**1. Token Custody** ✅
- Users always control their private keys
- Tokens only move when users sign transactions
- Backend cannot steal user funds

**2. Atomic Execution** ✅
- Keeta blockchain guarantees all-or-nothing swaps
- If swap fails, no tokens are lost
- Consensus validates all operations

**3. Pool Token Holdings** ✅
- Pool balances are verifiable on-chain
- Backend cannot create fake tokens
- Token transfers are immutably recorded

### Security Measures in Place

**1. Atomic Transactions**
```javascript
// Entire swap is one atomic transaction
// Either ALL operations succeed, or ALL fail
[
  userToTreasury(fee),    // ← All must succeed
  userToPool(tokenIn),    // ←
  poolToUser(tokenOut)    // ←
]
```

**2. Permission Model**
```
Pool STORAGE Account:
├── Owns tokens (RIDE, WAVE, etc.)
└── Grants SEND_ON_BEHALF to OPS account
    └── OPS can only send tokens users are owed
    └── OPS cannot withdraw tokens arbitrarily
```

**3. User Transaction Signing**
- Users must sign every transaction
- Backend cannot execute transactions without user approval
- Frontend shows exact amounts before signing

---

## Current Limitations

### 1. Backend Dependency
- **Issue:** DEX requires backend server to be online
- **Impact:** If server goes down, no swaps possible
- **Mitigation:** Planning production deployment with monitoring

### 2. Centralized Pool Registry
- **Issue:** Only backend knows which pools exist
- **Impact:** Users must trust pool list is complete/accurate
- **Future:** Store pool metadata on-chain in account info

### 3. LP Token Tracking
- **Issue:** LP shares stored in JSON files, not on-chain
- **Impact:** If files lost, LP positions could be disputed
- **Mitigation:** Regular backups, future DB migration

### 4. No Smart Contract Guarantees
- **Issue:** AMM logic not enforced by blockchain
- **Impact:** Backend could theoretically change formulas
- **Future:** When Keeta adds smart contracts, migrate to on-chain logic

---

## Why This Architecture?

### Keeta Blockchain Capabilities

**What Keeta HAS:**
- ✅ Token transfers (SEND operations)
- ✅ Atomic transactions (vote staples)
- ✅ Permission system (SEND_ON_BEHALF)
- ✅ Account metadata storage
- ✅ STORAGE accounts for holding multiple tokens

**What Keeta LACKS (currently):**
- ❌ Smart contract VM (no EVM, WASM, etc.)
- ❌ Deployable contracts
- ❌ On-chain programmable logic
- ❌ Contract storage for state

### Comparison to EVM DEXs

| Feature | Keeta DEX | Uniswap (EVM) |
|---------|-----------|---------------|
| **Pool state** | Off-chain (backend) | On-chain (contract) |
| **AMM logic** | Off-chain (backend) | On-chain (contract) |
| **LP tokens** | Off-chain tracking | On-chain ERC20 |
| **Swaps** | Atomic transactions | Smart contract call |
| **Trust model** | Trust backend + blockchain | Trust contract + blockchain |
| **Composability** | Limited | Full (contracts can interact) |

### This is NOT a Bug - It's a Feature Limitation

The Keeta blockchain **does not currently support smart contracts**. This is a protocol-level limitation that requires:
- Keeta team to design/implement a smart contract VM
- Network-wide upgrade (hard fork)
- Validator adoption

**We cannot add smart contracts ourselves** - this must come from the Keeta core developers.

---

## Transparency Commitments

### Open Source
- ✅ Backend code available for audit (Pool.js, PoolManager.js)
- ✅ AMM formulas visible and standard (Uniswap v2 constant product)
- ✅ Frontend code open for inspection

### Verifiability
- ✅ All swaps recorded on Keeta blockchain
- ✅ Pool token balances publicly queryable
- ✅ Transaction history immutable and auditable

### Roadmap
- 🔄 Migrate to production database (PostgreSQL)
- 🔄 Store pool metadata on-chain (account info)
- 🔄 Add backend redundancy/monitoring
- ⏳ Migrate to smart contracts when Keeta adds support

---

## How to Verify DEX Operations

### Check Pool Reserves
```javascript
// Via Keeta SDK
import { UserClient } from '@keetanetwork/keetanet-client';

const client = UserClient.fromNetwork('test', null);
const poolAddress = 'keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek';

// Get all balances
const balances = await client.getAllBalances({ account: poolAddress });
console.log(balances);
// [{ token: 'RIDE', balance: 1000000 }, { token: 'WAVE', balance: 2000000 }]
```

### Verify Swap Math
```javascript
// Constant product formula (Uniswap v2)
function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997; // 0.3% fee
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000) + amountInWithFee;
  return numerator / denominator;
}

// Example: Swap 10 RIDE
const reserveRIDE = 1000000;
const reserveWAVE = 2000000;
const amountOut = getAmountOut(10, reserveRIDE, reserveWAVE);
// Should match backend's quote
```

### Audit Transaction History
```javascript
// Get pool's transaction history
const history = await client.getHistory(poolAddress);

// Check all swaps
history.forEach(({ voteStaple }) => {
  voteStaple.blocks.forEach(block => {
    block.operations.forEach(op => {
      if (op.operation === 'SEND') {
        console.log(`${op.amount} ${op.token} from ${op.from} to ${op.to}`);
      }
    });
  });
});
```

---

## Frequently Asked Questions

### Q: Is this really "decentralized"?
**A:** Partially. Token custody and execution are decentralized (Keeta blockchain), but pool logic and state tracking are centralized (backend server). This is a **hybrid model** - more decentralized than a CEX, less than an EVM DEX.

### Q: Can the backend steal my tokens?
**A:** No. The backend cannot sign transactions on your behalf. Tokens only move when YOU sign with your private key. The backend orchestrates transactions but cannot execute them without your approval.

### Q: What if the backend server goes down?
**A:** Swaps will be unavailable until the server comes back online. Your tokens remain safe on-chain, but the DEX interface won't function. This is a known limitation we're working to mitigate with redundancy.

### Q: Can I verify my LP position?
**A:** Currently, LP positions are tracked off-chain. You can verify:
- ✅ Pool reserves (on-chain)
- ✅ Your token deposits (transaction history)
- ❌ Your exact LP share % (requires trusting backend)

### Q: Why not use Ethereum or another EVM chain?
**A:** This is specifically a Keeta-native DEX built for Keeta network tokens (RIDE, WAVE, KTA, etc.). Keeta is a separate blockchain with different characteristics than Ethereum.

### Q: Will this become fully on-chain eventually?
**A:** If/when Keeta adds smart contract support, we can migrate the AMM logic and LP token tracking on-chain. This would make it a "true" DeFi protocol comparable to Uniswap.

### Q: How is this different from a centralized exchange?
**A:**
- **CEX:** You deposit tokens, exchange controls custody, trades happen off-chain
- **Keeta DEX:** You keep custody, atomic swaps happen on-chain, only logic is centralized

### Q: Can I run my own backend?
**A:** Yes! The backend code is open source. You could run your own instance, though you'd need to:
- Track pool state independently
- Maintain LP position records
- Keep server online 24/7

---

## Risk Disclosure

**USE AT YOUR OWN RISK**

This DEX is in **active development** and has the following risks:

**Technical Risks:**
- ⚠️ Backend server downtime
- ⚠️ Calculation errors in AMM logic
- ⚠️ LP position tracking issues
- ⚠️ Data loss (JSON files)

**Trust Risks:**
- ⚠️ Backend operator could display incorrect info
- ⚠️ Pool list could be incomplete
- ⚠️ LP rewards could be miscalculated

**Blockchain Risks:**
- ⚠️ Keeta network issues
- ⚠️ Transaction failures
- ⚠️ Loss of funds due to user error

**Only swap amounts you can afford to lose. Start with small test transactions.**

---

## Future Improvements

### Short Term (In Progress)
- [ ] Migrate to PostgreSQL database
- [ ] Production server deployment
- [ ] Automated backups
- [ ] Uptime monitoring
- [ ] Health check endpoints

### Medium Term (Planned)
- [ ] Store pool metadata on-chain (account info)
- [ ] Multiple backend instances (redundancy)
- [ ] LP token ownership on-chain metadata
- [ ] Advanced swap routing
- [ ] Price oracle integration

### Long Term (Dependent on Keeta)
- [ ] Full smart contract migration (when available)
- [ ] On-chain LP tokens (fungible)
- [ ] On-chain AMM logic
- [ ] Composability with other protocols
- [ ] Governance tokens

---

## Contact & Support

- **GitHub Issues:** [Report bugs or request features]
- **Documentation:** See `/keeta/docs/` folder
- **Developer:** For questions about architecture or integration

---

## Conclusion

The Keeta DEX represents the **best possible DEX architecture given Keeta's current capabilities**. It leverages on-chain atomic transactions and token custody while handling complex AMM logic off-chain.

This hybrid model is transparent about its trust assumptions and provides verifiable on-chain settlement. When Keeta adds smart contract support, we can migrate to a fully on-chain model.

**Until then, users should understand they're trusting the backend for calculations and state tracking, while maintaining full custody of their tokens.**

---

*Last Updated: 2025-11-05*
*Architecture Version: 1.0 (Hybrid Backend-Orchestrated)*
