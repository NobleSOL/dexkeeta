# Silverback DEX - Complete User Guide
**For Keeta Network**

Welcome to Silverback DEX - the first decentralized exchange on the Keeta blockchain! This guide will help you understand how the DEX works, how to use it safely, and what makes it unique.

---

## Table of Contents

1. [What is Silverback DEX?](#what-is-silverback-dex)
2. [Quick Start Guide](#quick-start-guide)
3. [Understanding the Architecture](#understanding-the-architecture)
4. [How to Swap Tokens](#how-to-swap-tokens)
5. [How to Provide Liquidity](#how-to-provide-liquidity)
6. [Security & Safety](#security--safety)
7. [Mobile Experience](#mobile-experience)
8. [Understanding Fees](#understanding-fees)
9. [Trust Model & What's On-Chain](#trust-model--whats-on-chain)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

---

## What is Silverback DEX?

Silverback DEX is a **hybrid decentralized exchange** that enables permissionless token swaps on the Keeta blockchain.

### Key Features

**✅ Permissionless Swaps**
- Anyone can swap tokens without permission
- No KYC or registration required
- Full self-custody of your tokens

**✅ Atomic Transactions**
- All swap operations succeed or fail together
- No risk of partial execution
- Guaranteed all-or-nothing trades

**✅ On-Chain Settlement**
- All token transfers happen on Keeta blockchain
- Publicly verifiable transaction history
- Immutable and auditable ledger

**✅ Permissionless Liquidity**
- Anyone can create new liquidity pools
- Anyone can add or remove liquidity from pools
- Earn LP tokens representing your pool share
- Fungible LP tokens (Uniswap V2-style)

---

## Quick Start Guide

### Step 1: Access the DEX

**Desktop:** Visit [https://dexkeeta.vercel.app](https://dexkeeta.vercel.app)
**Mobile:** Same URL - optimized for mobile browsers!

### Step 2: Connect Your Keeta Wallet

1. Click "Import Wallet" in the Keeta section
2. Enter your Keeta wallet seed (64 hex characters)
3. Your wallet loads in your browser - we never see your private keys
4. You'll see your token balances automatically

**Important:** Your private keys stay in your browser's memory and are never sent to our servers.

### Step 3: Select Network

- Click the network dropdown (top right on desktop, next to logo on mobile)
- Choose "Keeta" for Keeta Network swaps
- Choose "Base" for EVM-based swaps (different network)

### Step 4: Make Your First Swap

1. Click the "Swap" tab
2. Select your input token (e.g., KTA)
3. Select your output token (e.g., RIDE)
4. Enter the amount you want to swap
5. Review the exchange rate and expected output
6. Click "Swap" and confirm the transaction
7. Wait for blockchain confirmation (usually < 30 seconds)

**Pro Tip:** Start with a small test swap to familiarize yourself with the process!

---

## Understanding the Architecture

Silverback DEX uses a unique architecture due to Keeta's current capabilities.

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Your Browser (Frontend)                                │
│  - Import wallet                                        │
│  - View pools and balances                             │
│  - Sign transactions                                    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ API Calls
                       ↓
┌─────────────────────────────────────────────────────────┐
│  Backend Server (Render/Railway)                        │
│  - Calculate swap amounts (AMM math)                    │
│  - Track pool reserves                                  │
│  - Route swaps through pools                            │
│  - Construct atomic transactions                        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ Keeta SDK
                       ↓
┌─────────────────────────────────────────────────────────┐
│  Keeta Blockchain                                       │
│  - Execute atomic swaps                                 │
│  - Transfer tokens on-chain                             │
│  - Store pool reserves                                  │
│  - Enforce consensus rules                              │
└─────────────────────────────────────────────────────────┘
```

### Why This Design?

**Keeta doesn't support smart contracts yet.** This means we can't deploy on-chain AMM logic like Uniswap. Instead:

- ✅ **Token custody:** On-chain (you control)
- ✅ **Token transfers:** On-chain (atomic)
- ✅ **Settlement:** On-chain (verifiable)
- ⚠️ **AMM calculations:** Off-chain (backend server)
- ⚠️ **Pool routing:** Off-chain (backend server)

When Keeta adds smart contracts, we'll migrate to a fully on-chain model.

---

## How to Swap Tokens

### Step-by-Step Swap Process

**1. Get a Quote**
- Frontend asks backend: "How much RIDE for 10 KTA?"
- Backend calculates using constant product formula: `x * y = k`
- You see: "You'll receive ~97,000 RIDE"

**2. Review the Swap**
- **Exchange Rate:** Current price (e.g., 1 KTA = 9,289 RIDE)
- **Price Impact:** How much your swap affects the price
- **Minimum Received:** Worst-case amount after slippage
- **Fee:** 0.3% total (0.25% to LPs, 0.05% to protocol)

**3. Sign the Transaction**
- Click "Swap"
- Your wallet asks you to confirm
- You sign with your private key (never leaves your browser)

**4. Atomic Execution**
The backend constructs two sequential transactions:

```javascript
TX1: User Sends Tokens (with fee split)
  1. You send 9.975 KTA to pool (99.75% - includes 0.25% LP fee)
  2. You send 0.005 KTA to treasury (0.05% protocol fee)

TX2: Pool Sends Output
  3. Pool sends 97,000 RIDE to you (via SEND_ON_BEHALF)
```

**Each transaction is atomic** - all operations within succeed together or fail together!

**5. Confirmation**
- Transaction broadcasts to Keeta blockchain
- Validators verify and execute atomically
- You receive your tokens (usually < 30 seconds)
- Transaction appears in Keeta Explorer

### Understanding Slippage

**Slippage** is the difference between expected and actual swap amount.

**Why it happens:**
- Other swaps happen before yours executes
- Pool reserves change between quote and execution
- Your swap moves the price (price impact)

**Slippage Protection:**
- Default tolerance: 0.5%
- If actual amount < (expected - slippage), transaction fails
- You keep your original tokens if slippage exceeded

**Adjusting Slippage:**
- Low slippage (0.1-0.5%): Safer, but might fail in volatile markets
- High slippage (1-5%): More likely to succeed, but you accept worse prices

---

## How to Provide Liquidity

### Permissionless Liquidity Provision

**✅ GREAT NEWS:** Anyone can now provide liquidity to Silverback DEX! The protocol supports fully permissionless liquidity provision with fungible LP tokens.

### How It Works

**Decentralized Liquidity Model:**
- Anyone can create new pools for any token pair
- Pool creators own their pools (not the DEX operator)
- Anyone can add or remove liquidity from any pool
- You receive LP tokens representing your share of the pool
- LP tokens are fungible and tradeable (Uniswap V2-style)
- Swap fees: 0.25% to LPs (stays in pool), 0.05% to protocol (treasury)

**Ownership Model:**
- Each pool is owned by its creator
- DEX operator (OPS) only has routing permissions (SEND_ON_BEHALF)
- OPS cannot drain pools or steal liquidity
- Creators maintain full control of their pools
- All liquidity operations are permissionless

### Adding Liquidity

**Step-by-Step Process:**

1. **Navigate to Pool Tab**
   - Click "Pool" in the navigation
   - View all available pools

2. **Select a Pool**
   - Choose an existing pool (e.g., KTA/RIDE)
   - Or create a new pool for a token pair

3. **Enter Amounts**
   - Enter the amount of Token A you want to add
   - Enter the amount of Token B you want to add
   - Amounts must maintain the pool's current ratio

4. **Review Details**
   - Check the exchange rate
   - View your pool share percentage
   - See estimated LP tokens you'll receive

5. **Confirm Transaction**
   - Click "Add Liquidity"
   - Sign the transaction with your wallet
   - Wait for blockchain confirmation

6. **Receive LP Tokens**
   - LP tokens are minted and sent to your wallet
   - LP tokens represent your share of the pool
   - You can view your LP balance in your wallet

**What Happens On-Chain:**
```
Transaction Flow:
1. You send Token A to the pool
2. You send Token B to the pool
3. Pool calculates your LP share
4. LP tokens are minted to your address
5. Your position is recorded on-chain
```

### Removing Liquidity

**Step-by-Step Process:**

1. **Navigate to Positions**
   - View your current LP positions
   - See your pool share and value

2. **Select Amount to Remove**
   - Choose how many LP tokens to redeem
   - View how much Token A and Token B you'll receive

3. **Two-Transaction Process**
   - **TX1:** You send LP tokens to the LP token account
   - **TX2:** OPS burns the LP token supply
   - Pool calculates your share of reserves
   - Tokens are sent back to your wallet

4. **Receive Your Tokens**
   - You receive your proportional share of Token A
   - You receive your proportional share of Token B
   - LP tokens are burned (supply decreases)

**Important:** Removing liquidity uses a two-transaction flow:
- First, you send your LP tokens (you control this)
- Then, OPS burns the supply (OPS owns the LP token account)
- This ensures proper permissions without requiring you to grant OPS access to your wallet

### Creating New Pools

**Anyone can create a new pool!**

1. **Select Token Pair**
   - Choose Token A and Token B
   - If pool doesn't exist, you'll be prompted to create it

2. **Add Initial Liquidity**
   - Set the initial exchange rate by providing both tokens
   - This ratio becomes the starting price

3. **Pool Creation**
   - New pool storage account is created
   - You become the pool owner
   - LP token account is created
   - Your initial LP tokens are minted

4. **OPS Permissions**
   - OPS receives SEND_ON_BEHALF permission (for routing swaps only)
   - You maintain OWNER permission (full control)
   - Anyone can add/remove liquidity permissionlessly

### Earning Fees

**How LP Earnings Work:**

- Every swap through the pool charges a 0.3% total fee
- 0.25% goes to LPs (stays in pool reserves)
- 0.05% goes to protocol (sent to treasury for operations)
- LP fees automatically increase the value of all LP tokens
- When you remove liquidity, you get your share of accumulated LP fees

**Example:**
```
Pool starts with: 1000 KTA + 1000 RIDE
You provide: 100 KTA + 100 RIDE (10% of pool)
You receive: 100 LP tokens

After swaps accumulate fees:
Pool grows to: 1050 KTA + 1050 RIDE

You remove liquidity (burn 100 LP tokens):
You receive: 105 KTA + 105 RIDE (10% of grown pool)
Your profit: 5 KTA + 5 RIDE (from fees)
```

---

## Security & Safety

### What You Control ✅

**Your Private Keys**
- Keys stay in your browser memory
- Never transmitted to servers
- You sign every transaction
- Backend cannot execute without your signature

**Your Tokens**
- You maintain custody at all times
- Tokens only move when you sign
- Backend cannot steal your funds
- Atomic swaps protect against partial execution

### What You Must Trust ⚠️

**Backend Server**
1. **Correct Calculations**
   - Constant product formula applied correctly
   - Slippage calculations accurate
   - Fee calculations (0.3%) honest

2. **Pool Routing**
   - Routes to correct pool for each pair
   - Doesn't hide pools from listing
   - Pool information is accurate

3. **Server Availability**
   - Stays online for swaps to work
   - Pool registry isn't lost
   - API endpoints remain accessible

**Important:** If backend goes down, your tokens are safe on-chain, but you can't swap until it's back online.

### Best Practices

**Protect Your Wallet:**
- ✅ Never share your seed phrase or private key
- ✅ Use strong passwords for encrypted exports
- ✅ Backup your wallet seed securely offline
- ✅ Test with small amounts before large swaps

**Verify Transactions:**
- ✅ Check amounts carefully before signing
- ✅ Review slippage tolerance (default 0.5%)
- ✅ Confirm token addresses in the UI
- ✅ Start small - test with $10 before $1000

**Recognize Risks:**
- ⚠️ This is experimental software
- ⚠️ Backend server dependency
- ⚠️ Calculation errors possible
- ⚠️ Loss of funds due to user error

**Only swap amounts you can afford to lose.**

---

## Mobile Experience

Silverback DEX is fully optimized for mobile browsers!

### Mobile Features

**Responsive Design:**
- ✅ Compact header layout
- ✅ Touch-friendly navigation
- ✅ Mobile-optimized card layouts
- ✅ Readable pool information

**Mobile Navigation:**
- Tap the menu icon (top right) to access:
  - Swap
  - Pool (view pools)
  - Positions (view holdings)

**Wallet Connection:**
- Import wallet works same as desktop
- Balances display in mobile-friendly format
- Address truncated for readability

### Mobile Tips

1. **Use landscape mode** for easier viewing of pool cards
2. **Double-check addresses** before confirming swaps
3. **Ensure stable internet** during transactions
4. **Save your seed phrase** securely before mobile wallet use

---

## Understanding Fees

### Swap Fees

**0.3% Total Swap Fee (SushiSwap Model)**
- Total fee: 0.3% (standard AMM rate, same as Uniswap V2)
- LP fee: 0.25% (83% of total) → Stays in pool reserves for LP token holders
- Protocol fee: 0.05% (17% of total) → Sent to treasury for operations

**Example:**
```
You swap: 10 KTA
Total fee: 0.3 KTA (0.3%)
  ├─ LP fee: 0.25 KTA → Pool reserves (LPs earn this)
  └─ Protocol fee: 0.05 KTA → Treasury (operations)
To pool: 9.975 KTA (includes LP fee)
```

### Network Fees

**Keeta Transaction Fee**
- Goes to Keeta network treasury
- Covers blockchain computation costs
- Usually very small (< $0.01 equivalent)
- Varies based on network congestion

### Total Cost

**When you swap 10 KTA for RIDE:**
```
Input:          10 KTA
Swap Fee:       -0.3 KTA total (0.3%)
  ├─ LP Fee:    -0.25 KTA (to pool reserves)
  └─ Protocol:  -0.05 KTA (to treasury)
Network Fee:    ~0.001 KTA  (goes to Keeta blockchain)
To Pool:        9.975 KTA (includes LP fee)
You Receive:    ~97,000 RIDE (based on AMM calculation)
```

**No Hidden Fees:**
- ✅ No deposit/withdrawal fees
- ✅ No listing fees
- ✅ No custody fees
- ✅ You pay exactly what you see

---

## Trust Model & What's On-Chain

### ✅ What's On-Chain (Trustless)

| Data | Location | How to Verify |
|------|----------|---------------|
| **Token balances** | Pool accounts | Query via Keeta API |
| **Token transfers** | Transaction history | View on Keeta Explorer |
| **Atomic execution** | Vote staples | All operations visible |
| **Your wallet balance** | Your account | Check anytime on-chain |

**Example Verification:**
```javascript
// Check pool reserves (anyone can do this)
import { UserClient } from '@keetanetwork/keetanet-client';

const client = UserClient.fromNetwork('test', null);
const poolAddress = 'keeta_atulpbgzwrphasyensi234jrpnyefv4fqoaovrjrex4cjw6rbiibq6panevsg';

const balances = await client.allBalances({ account: poolAddress });
// Returns: actual KTA and RIDE in the pool
```

### ⚠️ What's Off-Chain (Requires Trust)

| Data | Location | Trust Required |
|------|----------|---------------|
| **Pool registry** | `.pools.json` on server | Trust backend lists correct pools |
| **AMM calculations** | Backend logic | Trust math is correct |
| **Price quotes** | Backend response | Trust formula is standard |
| **Pool routing** | Backend decision | Trust correct pool selected |

**What This Means:**
- Backend could display incorrect swap amounts (but can't steal your tokens)
- Backend could hide pools from listing
- If backend goes down, swaps don't work (but tokens stay safe)

**But You Maintain:**
- ✅ Full custody of your tokens
- ✅ Ability to verify all on-chain data
- ✅ Atomic swap protection
- ✅ Immutable transaction history

---

## Troubleshooting

### Common Issues

**"Failed to fetch pools" Error**

**Cause:** Backend server unreachable
**Fix:**
- Check your internet connection
- Wait a moment and refresh the page
- Backend may be restarting (usually < 1 minute)

---

**"Insufficient balance" Error**

**Cause:** Not enough tokens for swap + fees
**Fix:**
- Reduce swap amount slightly
- Ensure you have tokens for network fees
- Check your wallet balance in the UI

---

**"Slippage tolerance exceeded" Error**

**Cause:** Price moved too much during transaction
**Fix:**
- Increase slippage tolerance in settings
- Try smaller swap amount (less price impact)
- Wait for less price volatility
- Check if pool has enough liquidity

---

**Transaction Pending Forever**

**Cause:** Keeta network congestion or issue
**Fix:**
- Wait for network confirmation (can take 1-2 minutes)
- Check transaction hash on Keeta Explorer
- Refresh the page to see updated status
- Contact support if stuck > 5 minutes

---

**Wallet Won't Connect**

**Cause:** Invalid seed format
**Fix:**
- Ensure seed is exactly 64 hex characters
- No spaces or special characters
- Seed should only contain 0-9 and a-f
- Try copying seed from secure storage

---

### Getting Help

**Technical Issues:**
- Check this guide's troubleshooting section
- View `/keeta/KEETA_DEX_ARCHITECTURE.md` for technical details
- Report bugs on GitHub Issues

**Security Concerns:**
- Report vulnerabilities responsibly
- Never share private keys in support requests

---

## FAQ

### General Questions

**Q: Is my wallet safe?**
A: Yes - your private keys never leave your browser. They're stored in memory only and never sent to servers. We cannot access your funds.

**Q: What if the backend server goes down?**
A: Swaps won't work until it's back online, but your tokens are 100% safe on-chain. You can always access them directly via the Keeta network.

**Q: How do I know the prices are fair?**
A: Prices follow the constant product formula (`x * y = k`), the same math as Uniswap V2. It's purely algorithmic and not controlled by anyone. You can verify the formula in the open-source code.

**Q: Can I cancel a transaction after signing?**
A: Once submitted to the Keeta blockchain, transactions cannot be cancelled. Always double-check amounts before signing!

**Q: Where can I see my transaction history?**
A: All transactions are on the Keeta blockchain. View them in:
- The Portfolio tab in the DEX
- Keeta Block Explorer
- Your wallet's transaction list

**Q: What happens if I lose my wallet seed?**
A: **Your tokens are permanently lost.** There is no recovery mechanism. Always backup your seed phrase securely offline!

---

### Technical Questions

**Q: Why isn't this fully decentralized like Uniswap?**
A: Keeta blockchain doesn't support smart contracts yet. We use atomic transactions and on-chain settlement, but AMM logic runs on a backend server. When Keeta adds smart contracts, we'll migrate to a fully on-chain model.

**Q: Can I verify the swap math?**
A: Yes! The constant product formula is:
```
amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
```
Where 997/1000 = 99.7% (accounting for 0.3% fee)

**Q: What prevents the backend from cheating?**
A: Technical honesty - the backend could display incorrect prices, but:
- Cannot steal your tokens (you sign transactions)
- Cannot execute without your approval
- All swaps are on-chain and verifiable
- Open-source code can be audited

**Q: Can I run my own backend?**
A: Yes! The code is open source. You'd need to:
- Clone the repository
- Track pool state independently
- Keep server online 24/7
- Maintain your own pool registry

---

### Liquidity Questions

**Q: Can I provide liquidity to pools?**
A: Yes! Liquidity provision is fully permissionless. Anyone can add or remove liquidity from any pool. You'll receive fungible LP tokens representing your share of the pool.

**Q: How do LP tokens work?**
A: Silverback DEX uses fungible LP tokens (Uniswap V2-style):
- One LP token per pool, shared by all liquidity providers
- LP tokens are minted when you add liquidity
- LP tokens can be traded or transferred
- Burn LP tokens to remove liquidity and get your tokens back
- LP token value grows as the pool earns fees

**Q: Who owns the pools?**
A: Each pool is owned by its creator:
- Pool creator has OWNER permission (full control)
- DEX operator (OPS) only has SEND_ON_BEHALF permission (for routing swaps)
- OPS cannot drain pools or steal liquidity
- Liquidity operations are fully permissionless

**Q: How do I earn fees as a liquidity provider?**
A: Fees are earned automatically:
- Every swap charges a 0.3% total fee
- 0.25% goes to LPs (stays in pool reserves)
- 0.05% goes to protocol (sent to treasury)
- LP fees increase the value of all LP tokens
- When you remove liquidity, you receive your proportional share of accumulated LP fees

**Q: What is impermanent loss?**
A: Impermanent loss occurs when token prices change after you provide liquidity:
- You provide liquidity at one price ratio
- Prices change in the market
- Arbitrageurs rebalance the pool
- You may end up with less value than if you just held the tokens
- Loss becomes permanent when you remove liquidity
- Fees can offset impermanent loss over time

---

### Mobile Questions

**Q: Does Silverback DEX work on mobile?**
A: Yes! Fully optimized for mobile browsers with:
- Responsive layout
- Touch-friendly buttons
- Icon-only navigation
- Optimized pool cards

**Q: Can I use MetaMask Mobile?**
A: Not for Keeta swaps (Keeta uses different key format). For Keeta:
- Import your Keeta seed directly in the browser
- For Base network swaps, MetaMask works!

**Q: Is there a mobile app?**
A: Not yet - use the mobile web app at dexkeeta.vercel.app. A native app may come in the future.

---

## Roadmap

### What's Live Today ✅

- ✅ Permissionless token swaps
- ✅ Permissionless liquidity provision
- ✅ Fungible LP tokens (Uniswap V2-style)
- ✅ Creator-owned pools
- ✅ Atomic transaction execution
- ✅ Mobile-responsive UI
- ✅ Multiple token pairs
- ✅ Real-time price quotes
- ✅ Wallet import/export
- ✅ Transaction history
- ✅ Pool reserve display

### Coming Soon 🔜

**Short Term (Weeks)**
- Better mobile optimizations
- Price charts and analytics
- More token pairs
- Transaction history page
- Pool statistics

**Medium Term (Months)**
- Database migration (PostgreSQL)
- Production server deployment
- Uptime monitoring
- Automated backups
- Multiple backend instances (redundancy)

**Long Term (Dependent on Keeta)**
- Smart contract migration
- Governance system
- Full DeFi composability
- Cross-chain liquidity aggregation

---

## Supported Tokens

**Currently Available:**
- **KTA** (Keeta native token)
- **RIDE** (Community token)
- **CAT** (Community token)

**Active Pools:**
- KTA/RIDE
- KTA/CAT

**Coming Soon:**
- More community tokens
- Stablecoins (when available)
- Governance tokens

**Want a new pool?**
- Anyone can create a pool for any token pair!
- Simply navigate to the Pool tab and create your pool
- You'll own the pool and earn fees from swaps

---

## Disclaimer

**THIS DEX IS EXPERIMENTAL SOFTWARE. USE AT YOUR OWN RISK.**

### No Warranties

- ❌ No guarantees of uptime or availability
- ❌ No insurance against loss of funds
- ❌ No warranty of correctness or accuracy
- ❌ No liability for bugs or errors

### Known Risks

**Technical Risks:**
- ⚠️ Backend server dependency (single point of failure)
- ⚠️ Possible calculation errors in AMM logic
- ⚠️ Data loss risk (JSON file storage)
- ⚠️ Software bugs or vulnerabilities

**Trust Risks:**
- ⚠️ Backend operator could display incorrect information
- ⚠️ Pool list could be incomplete
- ⚠️ Price quotes could be miscalculated
- ⚠️ Operator controls all liquidity

**Blockchain Risks:**
- ⚠️ Keeta network downtime or issues
- ⚠️ Transaction failures
- ⚠️ Loss of funds due to user error (wrong address, lost seed, etc.)

### Your Responsibilities

**By using Silverback DEX, you acknowledge:**
- You understand the trust assumptions
- You accept all risks
- You have verified the information independently
- You will not hold the operator liable for losses
- You are solely responsible for your private keys
- You understand this is experimental software

**Only use funds you can afford to lose.**

---

## Contact & Support

**Website:** https://dexkeeta.vercel.app
**GitHub:** https://github.com/NobleSOL/dexkeeta
**Documentation:** `/keeta/docs/` folder in the repository

**For Support:**
- Technical issues: GitHub Issues
- Security concerns: Responsible disclosure
- General questions: Check this guide first!

---

## Acknowledgments

Built with:
- **Keeta Network** - Layer 1 blockchain
- **React** - Frontend framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Express** - Backend server
- **Vercel** - Frontend hosting
- **Render** - Backend hosting

Special thanks to the Keeta community for testing and feedback!

---

## Conclusion

Silverback DEX represents the **best possible DEX architecture given Keeta's current capabilities**. It leverages:

✅ On-chain atomic transactions
✅ On-chain token custody and settlement
✅ Permissionless trading and liquidity provision
✅ Fungible LP tokens (Uniswap V2-style)
✅ Creator-owned pools with decentralized control
⚠️ Off-chain AMM calculations (transparent limitation)

This hybrid model is **honest about its trust assumptions** and provides **verifiable on-chain settlement**. When Keeta adds smart contract support, we'll migrate to a fully on-chain model.

**Until then, users should understand:**
- You're trusting the backend for calculations and routing
- You maintain full custody of your tokens and LP tokens
- Swaps and liquidity operations are atomic and verifiable on-chain
- Pool creators own their pools (not the DEX operator)
- This is an interim solution, not the final form

**Happy trading! 🚀**

---

*Last Updated: 2025-11-14*
*Version: 4.0 (Permissionless liquidity provision with fungible LP tokens)*
*Guide Author: Silverback Team*
