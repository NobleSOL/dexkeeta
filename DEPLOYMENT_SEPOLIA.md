# Base Sepolia Testnet Deployment

## Deployed Contracts (Base Sepolia - Chain ID: 84532)

### SilverbackFactoryV0
- **Address:** `0x099869678bCCc5514e870e7d5A8FacF0E7cFF877`
- **Deployer:** `0x21fdEd74C901129977B8e28C2588595163E1e235`
- **Fee Recipient (feeTo):** `0x21fdEd74C901129977B8e28C2588595163E1e235`
- **Fee Setter:** `0x21fdEd74C901129977B8e28C2588595163E1e235`
- **Features:**
  - Deploys PairV0 contracts with protocol fee mechanism
  - Collects 1/6 of swap fees (0.05%) to protocol
  - 5/6 of swap fees (0.25%) go to LPs

### SilverbackUnifiedRouterV0
- **Address:** `0xb7e572F32402256cd88ae14FfA677a40Bc43e5c6`
- **Factory:** `0x099869678bCCc5514e870e7d5A8FacF0E7cFF877`
- **WETH:** `0x4200000000000000000000000000000000000006` (Base WETH)
- **Router Fee:** 0% (NO ROUTER FEES)
- **Pair Fee:** 0.3% (0.05% protocol + 0.25% LP)
- **Features:**
  - Clean router for direct Silverback swaps
  - No router-level fees
  - Only pair-level fees apply

## Contract Verification

### Manual Verification on Basescan

**FactoryV0:**
1. Go to: https://sepolia.basescan.org/address/0x099869678bCCc5514e870e7d5A8FacF0E7cFF877#code
2. Contract: `SilverbackFactoryV0`
3. Constructor argument: `0x21fdEd74C901129977B8e28C2588595163E1e235` (address)

**RouterV0:**
1. Go to: https://sepolia.basescan.org/address/0xb7e572F32402256cd88ae14FfA677a40Bc43e5c6#code
2. Contract: `SilverbackUnifiedRouterV0`
3. Constructor arguments:
   - `_factory`: `0x099869678bCCc5514e870e7d5A8FacF0E7cFF877`
   - `_WETH`: `0x4200000000000000000000000000000000000006`

## Environment Variables

Add these to your `.env` file for frontend testing:

```bash
# Sepolia V0 Contracts (for testing)
VITE_SB_FACTORY_V0=0x099869678bCCc5514e870e7d5A8FacF0E7cFF877
VITE_SB_ROUTER_V0=0xb7e572F32402256cd88ae14FfA677a40Bc43e5c6
```

## Fee Structure

| Component | Fee | Recipient |
|-----------|-----|-----------|
| **RouterV0** | 0% | N/A |
| **Pair Swap Fee** | 0.3% | Split between protocol and LPs |
| **Protocol Share** | 0.05% | Fee recipient (feeTo address) |
| **LP Share** | 0.25% | Liquidity providers |
| **Total User Cost** | 0.3% | Industry standard |

## Next Steps

1. ✅ **Contracts Deployed** - FactoryV0 and RouterV0 on Base Sepolia
2. ⏳ **Verify Contracts** - Manually verify on Basescan
3. ⏳ **Test Contracts** - Create test pairs and execute swaps
4. ⏳ **Deploy to Mainnet** - After successful testing

## Testing Checklist

- [ ] Verify FactoryV0 on Basescan
- [ ] Verify RouterV0 on Basescan
- [ ] Create a test pair (e.g., WETH/TestToken)
- [ ] Add liquidity to test pair
- [ ] Execute test swaps
- [ ] Verify protocol fees are collected
- [ ] Test swap routing in frontend
- [ ] Verify quote accuracy

## Deployment Commands

```bash
# Check deployer address and balance
npx hardhat run scripts/check-deployer.cjs --network base-sepolia

# Deploy FactoryV0
npx hardhat run scripts/deploy-factoryv0.cjs --network base-sepolia

# Deploy RouterV0
npx hardhat run scripts/deploy-routerv0.cjs --network base-sepolia
```

## Network Info

- **Network:** Base Sepolia
- **Chain ID:** 84532
- **RPC:** https://sepolia.base.org
- **Explorer:** https://sepolia.basescan.org
- **Faucet:** https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
