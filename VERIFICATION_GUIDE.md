# Manual Contract Verification Guide

## Base Sepolia V0 Contracts

### Deployed Contracts

- **FactoryV0:** `0x099869678bCCc5514e870e7d5A8FacF0E7cFF877`
- **RouterV0:** `0xb7e572F32402256cd88ae14FfA677a40Bc43e5c6`
- **Deployer:** `0x21fdEd74C901129977B8e28C2588595163E1e235`

---

## 1. Verify SilverbackFactoryV0

### Step 1: Go to Basescan
https://sepolia.basescan.org/address/0x099869678bCCc5514e870e7d5A8FacF0E7cFF877#code

### Step 2: Click "Verify and Publish"

### Step 3: Fill in the form

**Contract Address:**
```
0x099869678bCCc5514e870e7d5A8FacF0E7cFF877
```

**Compiler Type:**
- Select: **Solidity (Single file)**

**Compiler Version:**
- Select: **v0.8.20+commit.a1b79de6**

**Open Source License Type:**
- Select: **MIT License (MIT)**

### Step 4: Contract Code

You'll need to flatten the contract. Run this command:

```bash
npx hardhat flatten contracts/SilverbackFactoryV0.sol > SilverbackFactoryV0_flat.sol
```

Then paste the contents of `SilverbackFactoryV0_flat.sol` into the form.

**OR** upload the file directly if Basescan supports it.

### Step 5: Optimization

**Optimization:**
- Select: **Yes**

**Runs (Optimizer):**
```
200
```

### Step 6: Constructor Arguments (ABI-encoded)

**Constructor signature:**
```solidity
constructor(address _feeToSetter)
```

**Parameter values:**
- `_feeToSetter`: `0x21fdEd74C901129977B8e28C2588595163E1e235`

**ABI-encoded (paste this):**
```
00000000000000000000000021fded74c901129977b8e28c2588595163e1e235
```

To generate this yourself:
```javascript
const ethers = require('ethers');
const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
  ['address'],
  ['0x21fdEd74C901129977B8e28C2588595163E1e235']
);
console.log(encoded.slice(2)); // Remove '0x' prefix
```

### Step 7: Submit

Click "Verify and Publish"

---

## 2. Verify SilverbackUnifiedRouterV0

### Step 1: Go to Basescan
https://sepolia.basescan.org/address/0xb7e572F32402256cd88ae14FfA677a40Bc43e5c6#code

### Step 2: Click "Verify and Publish"

### Step 3: Fill in the form

**Contract Address:**
```
0xb7e572F32402256cd88ae14FfA677a40Bc43e5c6
```

**Compiler Type:**
- Select: **Solidity (Single file)**

**Compiler Version:**
- Select: **v0.8.20+commit.a1b79de6**

**Open Source License Type:**
- Select: **MIT License (MIT)**

### Step 4: Contract Code

Flatten the contract:

```bash
npx hardhat flatten contracts/SilverbackUnifiedRouterV0.sol > SilverbackUnifiedRouterV0_flat.sol
```

Then paste the contents into the form.

### Step 5: Optimization

**Optimization:**
- Select: **Yes**

**Runs (Optimizer):**
```
200
```

### Step 6: Constructor Arguments (ABI-encoded)

**Constructor signature:**
```solidity
constructor(address _factory, address _WETH)
```

**Parameter values:**
- `_factory`: `0x099869678bCCc5514e870e7d5A8FacF0E7cFF877`
- `_WETH`: `0x4200000000000000000000000000000000000006`

**ABI-encoded (paste this):**
```
000000000000000000000000099869678bccc5514e870e7d5a8facf0e7cff8770000000000000000000000004200000000000000000000000000000000000006
```

To generate this yourself:
```javascript
const ethers = require('ethers');
const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
  ['address', 'address'],
  [
    '0x099869678bCCc5514e870e7d5A8FacF0E7cFF877',
    '0x4200000000000000000000000000000000000006'
  ]
);
console.log(encoded.slice(2)); // Remove '0x' prefix
```

### Step 7: Submit

Click "Verify and Publish"

---

## Quick Commands

### Generate Flattened Files

```bash
# Flatten FactoryV0
npx hardhat flatten contracts/SilverbackFactoryV0.sol > SilverbackFactoryV0_flat.sol

# Flatten RouterV0
npx hardhat flatten contracts/SilverbackUnifiedRouterV0.sol > SilverbackUnifiedRouterV0_flat.sol
```

### Generate ABI-encoded Constructor Arguments

**For FactoryV0:**
```javascript
node -e "
const ethers = require('ethers');
console.log(ethers.AbiCoder.defaultAbiCoder().encode(
  ['address'],
  ['0x21fdEd74C901129977B8e28C2588595163E1e235']
).slice(2));
"
```

**For RouterV0:**
```javascript
node -e "
const ethers = require('ethers');
console.log(ethers.AbiCoder.defaultAbiCoder().encode(
  ['address', 'address'],
  ['0x099869678bCCc5514e870e7d5A8FacF0E7cFF877', '0x4200000000000000000000000000000000000006']
).slice(2));
"
```

---

## Deployment Parameters Summary

| Contract | Parameter | Value |
|----------|-----------|-------|
| **FactoryV0** | `_feeToSetter` | `0x21fdEd74C901129977B8e28C2588595163E1e235` |
| **RouterV0** | `_factory` | `0x099869678bCCc5514e870e7d5A8FacF0E7cFF877` |
| **RouterV0** | `_WETH` | `0x4200000000000000000000000000000000000006` |

**Compiler Settings:**
- Version: `0.8.20`
- Optimization: Enabled
- Runs: `200`
- EVM Version: `paris`
- License: `MIT`

---

## Troubleshooting

### "Compiler version mismatch"
Make sure you select **v0.8.20+commit.a1b79de6** exactly.

### "Constructor argument mismatch"
- Make sure there's no `0x` prefix in the ABI-encoded arguments
- Double-check the addresses match exactly (lowercase)

### "Bytecode mismatch"
- Ensure optimization is set to **Yes** with **200 runs**
- Make sure you're using the flattened file

### "SPDX license identifier not provided"
Add this at the top of your flattened file:
```solidity
// SPDX-License-Identifier: MIT
```
