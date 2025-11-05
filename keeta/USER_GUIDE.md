# Keeta DEX User Guide

## What is the Keeta DEX?

A self-custodial decentralized exchange for swapping Keeta network tokens (RIDE, WAVE, KTA, etc.).

**Unique Feature:** Pool creators own and control their liquidity directly - no custody by the platform!

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

### 4. Create a Pool (Become a Market Maker!)
- Choose a token pair (e.g., RIDE/WAVE)
- If no pool exists, YOU can create it
- **You will own this pool** - full self-custody!
- Only ONE pool allowed per pair (first come, first served)
- You earn 100% of swap fees for your pair

### 5. Add Liquidity to YOUR Pool
- Add tokens to the pool you own
- Maintain full custody (you control withdrawals)
- Earn 0.3% fee from every swap through your pool

### 6. Remove Liquidity from YOUR Pool
- Withdraw from your pool anytime (you're the owner!)
- Receive your tokens back plus all earned fees
- No permission needed - it's your pool!

---

## How It Works (Simple Version)

```
You ────► Backend Server ────► Keeta Blockchain
         (Calculates math)     (Moves tokens)
```

**When you swap:**
1. Server calculates how many tokens you'll receive
2. You sign a transaction with your wallet
3. Blockchain executes the swap atomically
4. You receive your tokens instantly

**Your tokens never leave your control** - the server can only suggest transactions, YOU must sign them.

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
- Calculates swap amounts correctly
- Tracks your LP positions accurately
- Stays online for swaps to work

**Why?** Keeta doesn't support smart contracts yet, so the AMM math happens on our server instead of on-chain.

**What this means:**
- Server could theoretically display wrong prices (but can't steal tokens)
- If server goes down, swaps stop working (but tokens stay safe)
- LP positions are tracked off-chain (but token deposits are on-chain)

---

## Understanding the Architecture

### Comparison to Other DEXs

| Feature | Keeta DEX | Uniswap (Ethereum) | Coinbase (CEX) |
|---------|-----------|-------------------|----------------|
| **Pool ownership** | YOU own your pool | Protocol owns pools | Exchange owns liquidity |
| **Token custody** | You control (self-custodial!) | Deposit to protocol | Exchange controls |
| **Swap execution** | On-chain atomic | On-chain contract | Off-chain database |
| **AMM logic** | Off-chain server | On-chain contract | Centralized orderbook |
| **Who can provide liquidity** | Only pool creator | Anyone | Exchange only |
| **Trust required** | Backend routing | Smart contract code | Exchange operator |

### What Makes This Unique?

**Self-Custodial "Pool Operator" Model:**
- ✅ You OWN your pool (not just provide liquidity)
- ✅ Full custody of your tokens at all times
- ✅ Withdraw anytime without permission
- ✅ Earn 100% of fees from your pair
- ✅ On-chain settlement

**Trade-offs:**
- ⚠️ Only ONE pool per pair (first come, first served)
- ⚠️ Only pool creator can provide liquidity
- ⚠️ Server routes swaps (but can't steal funds)
- ⚠️ AMM logic calculated off-chain

**Why this design?** Keeta blockchain doesn't have smart contracts yet. This "pool operator" model maintains maximum custody while we wait for full on-chain capability.

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

*Last Updated: 2025-11-05*
