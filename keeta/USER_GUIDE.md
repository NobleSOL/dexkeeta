# Keeta DEX User Guide

## What is the Keeta DEX?

A permissionless decentralized exchange for swapping Keeta network tokens (RIDE, WAVE, KTA, TEST, etc.).

**Unique Feature:** Truly decentralized pool ownership - creators own their pools, and anyone can provide liquidity!

## Quick Start

### 1. Connect Your Wallet
- Click "Connect Wallet"
- Import your Keeta wallet seed or private key
- Your wallet stays in your browser - we never see your keys

### 2. View Your Tokens
- See all your Keeta token balances
- Tokens are always in your custody (not deposited to the DEX)

### 3. Swap Tokens
- Select tokens to swap (e.g., RIDE → WAVE)
- Enter amount
- Review the exchange rate and slippage
- Click "Swap" and confirm the transaction
- Your tokens swap atomically (all-or-nothing)

### 4. Create a Pool (Become a Liquidity Provider!)
- Choose a token pair (e.g., RIDE/TEST)
- If no pool exists, YOU can create it
- **You own the pool** - it's stored on-chain under your address
- Only ONE pool allowed per pair (first come, first served)
- Pool creators earn fees proportional to their liquidity

### 5. Add Liquidity to ANY Pool (Permissionless!)
- Add tokens to any existing pool - no permission needed!
- Your liquidity is tracked on-chain via the pool's storage account
- Earn 0.3% fee from swaps, proportional to your share of the pool
- The DEX router (OPS) facilitates transactions but never holds your funds

### 6. Remove Liquidity from Pools
- Withdraw your liquidity anytime from any pool you've provided to
- Receive your tokens back plus earned fees
- Proportional to your share of the total pool liquidity

---

## How It Works (Simple Version)

```
You ────► Backend Server ────► Keeta Blockchain
         (Calculates math)     (Routes swaps via OPS)
```

**When you swap:**
1. Server calculates how many tokens you'll receive (using AMM formula)
2. You sign and send tokenIn + fee to the pool (TX1)
3. OPS router (on-chain) sends tokenOut back to you using SEND_ON_BEHALF permission (TX2)
4. You receive your tokens instantly

**Your tokens never leave your control** - you send directly to pools, and the OPS router facilitates the return transfer. No custodial intermediary!

---

## Important: What to Know

### ✅ What's Safe

**You Control Your Tokens**
- Private keys stay in your wallet
- Tokens only move when YOU sign
- Server cannot steal your funds

**Atomic Swaps**
- Entire swap succeeds or fails together
- No partial execution
- If it fails, you keep your tokens

**On-Chain Settlement**
- All token transfers happen on Keeta blockchain
- Publicly verifiable transaction history
- Immutable ledger

### ⚠️ What to Trust

**Backend Server**
- Calculates swap amounts correctly (AMM formula: x * y = k)
- Tracks LP positions (reads from on-chain pool storage)
- Stays online for UI to work

**OPS Router (On-Chain)**
- Facilitates token transfers between users and pools
- Has SEND_ON_BEHALF permission on pools to complete swaps
- Cannot steal funds (only moves tokens according to approved transactions)

**Why this architecture?** Keeta doesn't support smart contracts yet, so the AMM math happens on our server. The OPS router acts like an EVM router (e.g., Uniswap Router) - it coordinates transactions but doesn't custody funds.

**What this means:**
- Server could theoretically display wrong prices (but you always approve the exact amounts)
- If server goes down, UI stops working (but tokens stay safe in pools)
- OPS router can only move tokens as part of legitimate swaps (enforced by Keeta permissions)
- LP positions are tracked on-chain via pool storage accounts

---

## Understanding the Architecture

### Comparison to Other DEXs

| Feature | Keeta DEX | Uniswap (Ethereum) | Coinbase (CEX) |
|---------|-----------|-------------------|----------------|
| **Pool ownership** | Creator owns pool | Protocol owns pools | Exchange owns liquidity |
| **Token custody** | Non-custodial (pools on-chain) | Non-custodial (deposit to protocol) | Custodial (exchange controls) |
| **Swap execution** | On-chain atomic (2 TX) | On-chain contract (1 TX) | Off-chain database |
| **AMM logic** | Off-chain server | On-chain contract | Centralized orderbook |
| **Who can provide liquidity** | Anyone (permissionless!) | Anyone | Exchange only |
| **Trust required** | Backend calculations + OPS router | Smart contract code | Exchange operator |

### What Makes This Unique?

**Decentralized Pool Ownership + Permissionless Liquidity:**
- ✅ Pool creators OWN their pools (stored under their address)
- ✅ Anyone can add liquidity to any pool (no permission needed!)
- ✅ OPS router facilitates swaps (like Uniswap Router) but doesn't custody funds
- ✅ All liquidity tracked on-chain in pool storage accounts
- ✅ On-chain settlement with atomic swaps
- ✅ Proportional fee distribution to all liquidity providers

**Trade-offs:**
- ⚠️ Only ONE pool per pair (first come, first served)
- ⚠️ Server calculates AMM math off-chain (but you approve exact amounts)
- ⚠️ OPS router has SEND_ON_BEHALF permission (needed to complete swaps)
- ⚠️ Two-transaction swap model (TX1: user→pool, TX2: pool→user via OPS)

**Why this design?** Keeta blockchain doesn't have smart contracts yet. This architecture mimics EVM DEXs (creator-owned pools + router pattern) while maintaining decentralization and permissionless access.

---

## Fees

**Swap Fee:** 0.3% per swap
- Goes to liquidity providers
- Standard AMM rate

**Network Fee:** Variable
- Goes to Keeta treasury
- Covers blockchain transaction costs
- Usually very small

**No Hidden Fees:**
- No deposit/withdrawal fees
- No custody fees
- You pay exactly what you see

---

## Liquidity Providing

### How It Works

**1. Add Liquidity**
```
You deposit:  100 RIDE + 200 WAVE
You receive:  LP tokens representing your share
```

**2. Earn Fees**
- Every swap pays 0.3% fee to the pool
- Fees accumulate in the pool reserves
- Your share grows automatically

**3. Remove Liquidity**
```
You redeem:   Your LP tokens
You receive:  Your share of pool (including fees)
```

### Understanding Impermanent Loss

When token prices change, liquidity providers can experience "impermanent loss":

**Example:**
- You add 100 RIDE + 200 WAVE (pool price: 1 RIDE = 2 WAVE)
- RIDE price doubles (now 1 RIDE = 4 WAVE)
- Your pool share is now worth LESS than if you just held the tokens

**Why?** The AMM constantly rebalances the pool as people swap, so you end up with more of the token that went down and less of the token that went up.

**Tips:**
- Only provide liquidity to pairs you believe in long-term
- Fees can offset impermanent loss for high-volume pools
- Stablecoin pairs (if available) have minimal impermanent loss

---

## Security Best Practices

### Protect Your Wallet
- ✅ **Never share** your seed phrase or private key
- ✅ **Use strong passwords** for encrypted exports
- ✅ **Backup** your wallet seed securely offline
- ✅ **Test with small amounts** before large swaps

### Verify Transactions
- ✅ **Check amounts** carefully before signing
- ✅ **Review slippage** tolerance (default 0.5%)
- ✅ **Confirm token addresses** in the UI
- ✅ **Start small** - test with $10 before $1000

### Recognize Risks
- ⚠️ This is experimental software
- ⚠️ Smart contract risk (when available)
- ⚠️ Impermanent loss for LPs
- ⚠️ Backend server dependency

**Only swap what you can afford to lose.**

---

## Troubleshooting

### "Failed to fetch" Error
**Cause:** Backend server unreachable
**Fix:**
- Check your internet connection
- Wait a moment and refresh
- Server might be restarting

### "Insufficient balance" Error
**Cause:** Not enough tokens for swap + fees
**Fix:**
- Reduce swap amount slightly
- Ensure you have tokens for network fees

### "Slippage tolerance exceeded" Error
**Cause:** Price moved too much during transaction
**Fix:**
- Increase slippage tolerance (Settings)
- Try smaller swap amount
- Wait for less price volatility

### Transaction Pending Forever
**Cause:** Keeta network congestion
**Fix:**
- Wait for network confirmation (can take minutes)
- Check transaction hash on Keeta explorer
- Contact support if stuck > 1 hour

---

## Supported Tokens

Current liquidity pools:
- RIDE/WAVE
- (More pools coming soon)

Want a new pool?
- Anyone can create pools (permissionless)
- Contact us to get listed in UI
- Provide liquidity to bootstrap the pool

---

## Frequently Asked Questions

**Q: Is my wallet safe?**
A: Yes - your private keys never leave your browser. We cannot access your funds.

**Q: What if the server goes down?**
A: Swaps won't work until it's back, but your tokens are safe on-chain. You can always access them directly via Keeta network.

**Q: How do I know the prices are fair?**
A: Prices follow the constant product formula (x * y = k), the same math as Uniswap. It's purely algorithmic, not controlled by anyone.

**Q: Can I cancel a transaction?**
A: Once submitted to the Keeta blockchain, transactions cannot be cancelled. Double-check before signing!

**Q: Where can I see my transaction history?**
A: All transactions are on the Keeta blockchain. View them in the Portfolio tab or on a Keeta block explorer.

**Q: What happens if I lose my wallet?**
A: If you lose your seed phrase/private key, your tokens are permanently lost. Always backup securely!

**Q: Why isn't this fully decentralized like Uniswap?**
A: Keeta blockchain doesn't support smart contracts yet. When it does, we'll migrate to full on-chain DEX.

---

## Roadmap

**Coming Soon:**
- More token pairs
- Price charts and analytics
- Better mobile experience
- Transaction history page

**Future (When Keeta Adds Smart Contracts):**
- Fully on-chain AMM logic
- On-chain LP tokens
- Composability with other protocols
- Governance system

---

## Get Help

**Technical Issues:**
- Check troubleshooting section above
- View `/keeta/KEETA_DEX_ARCHITECTURE.md` for technical details

**Security Concerns:**
- Report vulnerabilities responsibly
- Never share private keys in support requests

---

## Disclaimer

**This DEX is experimental software. Use at your own risk.**

- No warranties or guarantees
- Possible bugs or downtime
- Funds could be lost due to software errors
- LP positions subject to impermanent loss
- Backend server required for operation

**By using this DEX, you accept these risks and take full responsibility for your transactions.**

---

*Happy swapping! 🔄*

*Last Updated: 2025-11-07*
