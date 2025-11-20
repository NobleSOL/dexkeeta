# Dual Router Integration Guide

## Overview

Your swap interface now supports **intelligent routing** between two routers:

1. **RouterV0** - Direct Silverback swaps (0% router fee, 0.3% pair fee)
2. **UnifiedRouter** - Aggregated swaps (0.3% router fee collected by you)

## How It Works

```
User initiates swap
        ↓
Check: Does Silverback pair exist?
        ↓
    Yes ↙   ↘ No
Get both quotes  → Use aggregator only
        ↓
Compare prices
        ↓
Pick best route
        ↓
Execute swap with selected router
```

## Setup

### 1. Deploy V0 Contracts

```bash
# Deploy FactoryV0
npx hardhat run scripts/deploy-factoryv0.js --network base

# Deploy RouterV0 (pass factory address from above)
npx hardhat run scripts/deploy-routerv0.js --network base

# Set feeTo address to collect protocol fees
# factory.setFeeTo(YOUR_WALLET_ADDRESS)
```

### 2. Add Environment Variables

```env
# .env
VITE_SB_FACTORY_V0=0x... # Your deployed FactoryV0 address
VITE_SB_ROUTER_V0=0x...  # Your deployed RouterV0 address
VITE_SB_ROUTER_UNIFIED=0x4752Ba5DbC23F44d87826276Bf6fD6B1c372AD24 # Current UnifiedRouter
```

### 3. Integrate into Swap Card

```typescript
import { createSwapRouter } from '@/lib/swap-router';
import { SILVERBACK_FACTORY_V0, SILVERBACK_ROUTER_V0, SILVERBACK_ROUTER_UNIFIED } from '@/amm/config';

// In your swap component
const swapRouter = createSwapRouter(
  SILVERBACK_FACTORY_V0 as `0x${string}`,
  SILVERBACK_ROUTER_V0 as `0x${string}`,
  SILVERBACK_ROUTER_UNIFIED as `0x${string}`,
  provider
);

// Get best route
const bestRoute = await swapRouter.getBestRoute({
  tokenIn: tokenInAddress,
  tokenOut: tokenOutAddress,
  amountIn: amountInWei,
  slippage: 0.5,
  userAddress: address,
}, chainId);

if (!bestRoute) {
  // No routes available
  return;
}

// Show route info to user
console.log(`Best route: ${bestRoute.source}`);
console.log(`You get: ${bestRoute.amountOutHuman} tokens`);
console.log(`Fee: ${bestRoute.fee}`);
console.log(`Using: ${bestRoute.router}`);

// Approve tokens to the selected router
const token = new ethers.Contract(tokenInAddress, ERC20_ABI, signer);
await token.approve(bestRoute.routerAddress, amountInWei);

// Execute swap
const tx = await swapRouter.executeSwap(bestRoute, {
  tokenIn: tokenInAddress,
  tokenOut: tokenOutAddress,
  amountIn: amountInWei,
  slippage: 0.5,
  userAddress: address,
}, signer);

await tx.wait();
```

## Fee Structure

| Route | Router Fee | Pair/Protocol Fee | Your Revenue | LP Revenue | User Cost |
|-------|------------|-------------------|--------------|------------|-----------|
| **Silverback Direct** | 0% | 0.3% (0.05% protocol + 0.25% LP) | 0.05% | 0.25% | **0.3%** |
| **Aggregator** | 0.3% | Aggregator fees | 0.3% | 0% | **0.3% + agg fees** |

## Benefits

✅ **Competitive pricing** - 0.3% on direct swaps matches industry standard
✅ **Always best price** - Automatically routes to cheapest option
✅ **Revenue from both** - Collect fees whether using Silverback or aggregator
✅ **No user confusion** - They just click "Swap" and get best price

## Next Steps

1. Deploy FactoryV0 and RouterV0 contracts
2. Update `.env` with deployed addresses
3. Test both routing paths work
4. Deploy to production

## Testing

```typescript
// Test Silverback route (when pair exists)
const route = await swapRouter.getSilverbackQuote(WETH, USDC, parseEther('1'));
console.log('Silverback route:', route);

// Test aggregator route
const aggRoute = await swapRouter.getAggregatorQuote(WETH, USDC, parseEther('1'), 0.5, 8453);
console.log('Aggregator route:', aggRoute);

// Test best route selection
const best = await swapRouter.getBestRoute({...}, 8453);
console.log('Best route:', best.router, best.source);
```
