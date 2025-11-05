# Base DEX Migration Plan
## From: /home/taylo/dex → To: /home/taylo/dexkeeta

**Date:** 2025-11-05
**Purpose:** Migrate updated Base DEX components to dexkeeta without breaking Keeta functionality

---

## Pre-Migration Checklist

- [x] Production /home/taylo/dex is NOT running
- [ ] Backup current /home/taylo/dexkeeta state
- [ ] Create git commit before migration
- [ ] Keeta dev server is running (don't break it!)

---

## Files to Migrate (Base-Only)

### Priority 1: Contract Addresses & Config

**1. client/amm/config.ts**
- Source: Updated contract addresses in `/home/taylo/dex`
- OLD Factory: `0xF925941026a46244dFFC236F2A01F1282ecFFa6d`
- NEW Factory: `0xd0918593070682AA60Ef6367FAd43A20acaEE94d`
- OLD Router: `0x46CC63663a5f7bD17c664BfFe35546f13B788303`
- NEW Router: `0x565cBf0F3eAdD873212Db91896e9a548f6D64894`
- ⚠️ **CAREFUL**: Preserve Keeta-specific `getApiBaseUrl()` logic

**2. deployment-mainnet.json**
- Full replacement (Base-only data)
- Contains verified contract links

### Priority 2: Client Components

**3. client/pages/Pool.tsx**
- Compare: `/home/taylo/dex` vs `/home/taylo/dexkeeta`
- Last updated: Nov 4, 2024 in /dex
- Check for Base DEX improvements

**4. client/pages/Portfolio.tsx**
- Compare first, may have Base improvements

**5. client/components/pool/ActivePoolsList.tsx**
- Base-specific pool display logic

**6. client/components/layout/Header.tsx**
- ⚠️ **CAREFUL**: dexkeeta has network switcher (Keeta/Base)
- Only merge Base improvements, don't remove Keeta logic

**7. client/wallet/config.ts**
- Check for wagmi config updates

### Priority 3: Smart Contracts

**8. contracts/SilverbackPair.sol**
- Compare for bug fixes or improvements

**9. contracts/SilverbackUnifiedRouter.sol**
- Compare for bug fixes or improvements

**10. contracts/mocks/**
- Copy entire directory (testing contracts)
- 4 files: FlashLoanAttacker, MaliciousERC20, MockERC20, MockWETH

### Priority 4: Server (if needed)

**11. server/index.ts**
- ⚠️ **VERY CAREFUL**: dexkeeta has Keeta routes
- Only merge Base improvements, don't remove Keeta endpoints

---

## Migration Strategy

### Safe Approach: File-by-File with Backups

```bash
# 1. Create backup
git add . && git commit -m "Pre-migration backup"

# 2. For each file:
#    a. Create backup: cp <file> <file>.backup
#    b. Compare: diff /home/taylo/dex/<file> /home/taylo/dexkeeta/<file>
#    c. Merge or replace
#    d. Test immediately
#    e. If broken, restore: mv <file>.backup <file>
```

---

## Files to PRESERVE (Keeta-Specific)

**DO NOT TOUCH:**
- `.env` - Contains Keeta OPS_SEED
- `.pools.json` - Keeta pool registry
- `server/keeta-impl/` - All Keeta backend logic
- `server/keeta-routes.ts` - Keeta API endpoints
- `client/components/keeta/` - All Keeta UI components
- `client/contexts/NetworkContext.tsx` - Network switcher
- `keeta/` - All documentation and scripts

---

## Step-by-Step Migration

### Phase 1: Contract Addresses (CRITICAL)

1. **Update client/amm/config.ts**
   ```bash
   # Backup current
   cp /home/taylo/dexkeeta/client/amm/config.ts /home/taylo/dexkeeta/client/amm/config.ts.backup

   # Compare
   diff /home/taylo/dex/client/amm/config.ts /home/taylo/dexkeeta/client/amm/config.ts

   # MANUAL EDIT: Update ONLY contract addresses
   # Keep: getApiBaseUrl() logic (Keeta-specific)
   ```

2. **Update deployment-mainnet.json**
   ```bash
   cp /home/taylo/dex/deployment-mainnet.json /home/taylo/dexkeeta/deployment-mainnet.json
   ```

3. **Test Base DEX still loads**
   - Switch to Base network
   - Check swap interface
   - Verify contract addresses in UI

### Phase 2: Client Components

4. **Compare and merge Pool.tsx**
   ```bash
   diff /home/taylo/dex/client/pages/Pool.tsx /home/taylo/dexkeeta/client/pages/Pool.tsx
   # If identical → skip
   # If different → review changes, merge improvements
   ```

5. **Compare and merge Portfolio.tsx**
   ```bash
   diff /home/taylo/dex/client/pages/Portfolio.tsx /home/taylo/dexkeeta/client/pages/Portfolio.tsx
   ```

6. **Compare and merge ActivePoolsList.tsx**
   ```bash
   diff /home/taylo/dex/client/components/pool/ActivePoolsList.tsx /home/taylo/dexkeeta/client/components/pool/ActivePoolsList.tsx
   ```

7. **CAREFULLY merge Header.tsx**
   ```bash
   diff /home/taylo/dex/client/components/layout/Header.tsx /home/taylo/dexkeeta/client/components/layout/Header.tsx
   # dexkeeta has: NetworkProvider, network switcher
   # ONLY take Base improvements, preserve Keeta logic
   ```

### Phase 3: Smart Contracts

8. **Update Solidity contracts**
   ```bash
   diff /home/taylo/dex/contracts/SilverbackPair.sol /home/taylo/dexkeeta/contracts/SilverbackPair.sol
   diff /home/taylo/dex/contracts/SilverbackUnifiedRouter.sol /home/taylo/dexkeeta/contracts/SilverbackUnifiedRouter.sol

   # If different, copy updated versions
   ```

9. **Copy mock contracts**
   ```bash
   cp -r /home/taylo/dex/contracts/mocks /home/taylo/dexkeeta/contracts/
   ```

### Phase 4: Verification

10. **Test Base DEX functionality**
    - [ ] Switch to Base network
    - [ ] Load swap page
    - [ ] Check token selector
    - [ ] Verify pool page loads
    - [ ] Check portfolio page

11. **Test Keeta DEX functionality**
    - [ ] Switch to Keeta network
    - [ ] KeetaDex component loads
    - [ ] Keeta wallet works
    - [ ] Pool creation works

12. **Final commit**
    ```bash
    git add .
    git commit -m "Migrate Base DEX updates from /home/taylo/dex"
    ```

---

## Rollback Plan

If anything breaks:

```bash
# Rollback to pre-migration state
git reset --hard HEAD~1

# Or restore specific file
mv <file>.backup <file>
```

---

## Post-Migration Tasks

- [ ] Update .env if needed (verify contract addresses match deployment-mainnet.json)
- [ ] Test swap on Base network
- [ ] Test liquidity provision on Base
- [ ] Verify Keeta still works
- [ ] Clean up .backup files
- [ ] Update VERCEL_ENV_VARS.txt if deploying

---

## Notes

- `/home/taylo/dex` is production Base DEX (leave untouched)
- `/home/taylo/dexkeeta` will become production for BOTH Base + Keeta
- This migration is ONLY for Base improvements, NOT Keeta changes
- Keeta dev server should keep running throughout migration
