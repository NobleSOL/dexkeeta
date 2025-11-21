# V0 Contracts - Base Sepolia Deployment

## Deployed Addresses

| Contract | Address | Status |
|----------|---------|--------|
| **FactoryV0** | `0x099869678bCCc5514e870e7d5A8FacF0E7cFF877` | ✅ Verified |
| **RouterV0** | `0x342d3879EbE201Db0966B595650c6614390857fa` | ✅ Verified |
| **WETH (Base)** | `0x4200000000000000000000000000000000000006` | Native |

## Configuration

- **Deployer**: `0x21fdEd74C901129977B8e28C2588595163E1e235`
- **Fee Recipient**: `0x21fdEd74C901129977B8e28C2588595163E1e235`
- **Compiler**: Solidity 0.8.20
- **Optimization**: Enabled (200 runs)
- **Network**: Base Sepolia (Chain ID: 84532)

## Fee Structure

### RouterV0
- **Router Fee**: 0% (NO ROUTER FEES)
- **Pair Fee**: 0.3% total
  - 0.05% to protocol (via LP token minting)
  - 0.25% to liquidity providers

### Purpose
This is the "clean" router for direct Silverback swaps with no router fees. Users only pay the 0.3% pair fee (split between protocol and LPs).

## Test Results

✅ **All tests passed on Base Sepolia**

**Test Summary:**
- Test Token: `0xCb5BE0b76ECBDE7439458A930E1894A6263f18fB`
- Test Pair: `0xd7666CC6B7dB064bF87D788B6647Ec8F19B74de2`
- Liquidity Added: 0.05 ETH + 100 TEST
- Swap Executed: 0.01 ETH → TEST
- Protocol Fees: ✅ Collecting correctly
- Total ETH Used: 0.06 ETH

**Key Features Tested:**
1. Pair creation via addLiquidityETH ✅
2. Token swaps via swapExactETHForTokens ✅
3. Protocol fee collection (0.05%) ✅
4. LP fee distribution (0.25%) ✅

## Technical Details

### CREATE2 Address Calculation Fix

**Issue Found:** Initial deployment had a bytecode mismatch causing swaps to fail.

**Root Cause:**
- `SilverbackPairV0` has modified bytecode (added `_mintFee()` and `kLast`)
- Original `SilverbackLibrary` used `SilverbackPair` bytecode for CREATE2 computation
- This caused router to compute wrong pair addresses

**Solution:**
- Created `SilverbackLibraryV0.sol` that uses `SilverbackPairV0` bytecode
- Updated `SilverbackUnifiedRouterV0.sol` to import `SilverbackLibraryV0`
- Redeployed RouterV0 with correct library reference

### Why We Needed PairV0

The original `SilverbackPair` contract:
- Had 0.3% swap fee going entirely to LPs
- Had NO protocol fee collection mechanism
- Had NO `_mintFee()` function or `kLast` variable

To implement protocol fee (0.05% of swaps):
- Must add `kLast` to track k = reserve0 * reserve1
- Must add `_mintFee()` to mint LP tokens to protocol based on k growth
- Must call `_mintFee()` in mint() and burn()

**This is the standard Uniswap V2 protocol fee mechanism** - it doesn't change the swap fee itself, but gives protocol a share by minting additional LP tokens.

## Basescan Links

- [FactoryV0](https://sepolia.basescan.org/address/0x099869678bCCc5514e870e7d5A8FacF0E7cFF877#code)
- [RouterV0](https://sepolia.basescan.org/address/0x342d3879EbE201Db0966B595650c6614390857fa#code)
- [Test Pair](https://sepolia.basescan.org/address/0xd7666CC6B7dB064bF87D788B6647Ec8F19B74de2)

## Next Steps

1. ✅ Sepolia testing complete
2. ⏳ Deploy to Base mainnet
3. ⏳ Update frontend .env with mainnet addresses
4. ⏳ Test on mainnet with small amounts
5. ⏳ Update frontend to use dual router system

## Environment Variables

Add to `.env`:
```bash
VITE_SB_FACTORY_V0=0x099869678bCCc5514e870e7d5A8FacF0E7cFF877
VITE_SB_ROUTER_V0=0x342d3879EbE201Db0966B595650c6614390857fa
```

## Gas Costs (Sepolia)

- **Factory Deployment**: ~3.5M gas
- **Router Deployment**: ~3.2M gas
- **Create Pair + Add Liquidity**: ~2M gas
- **Swap**: ~107k gas

---

**Status**: ✅ Ready for mainnet deployment
**Date**: 2025-11-21
