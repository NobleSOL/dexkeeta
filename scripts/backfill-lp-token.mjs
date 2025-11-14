#!/usr/bin/env node
/**
 * Backfill LP Token for Legacy Pool
 *
 * This script creates an LP token for a legacy pool that doesn't have one yet.
 * It:
 * 1. Creates a fungible LP token for the pool
 * 2. Mints LP shares to the current liquidity provider
 * 3. Updates .pools.json with the LP token address
 *
 * Usage:
 *   OPS_SEED=<ops-seed> node scripts/backfill-lp-token.mjs <poolAddress> <lpOwnerAddress>
 */

import { createLPToken, mintLPTokens, getOpsClient } from '../server/keeta-impl/utils/client.js';
import * as KeetaSDK from '@keetanetwork/keetanet-client';
import fs from 'fs';
import path from 'path';

const KEETA_NETWORK = 'test';
const POOLS_FILE = path.join(process.cwd(), '.pools.json');

// Get args
const poolAddress = process.argv[2];
const lpOwnerAddress = process.argv[3];

if (!poolAddress || !lpOwnerAddress) {
  console.error('Usage: OPS_SEED=<ops-seed> node scripts/backfill-lp-token.mjs <poolAddress> <lpOwnerAddress>');
  console.error('\nExample:');
  console.error('  OPS_SEED=abc123... node scripts/backfill-lp-token.mjs keeta_aqkyc... keeta_aabuf...');
  process.exit(1);
}

function sqrt(value) {
  if (value < 0n) {
    throw new Error('Square root of negative numbers is not supported');
  }
  if (value < 2n) {
    return value;
  }

  let x = value;
  let y = (x + 1n) / 2n;

  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }

  return x;
}

async function backfillLPToken() {
  console.log('\n🚀 Backfilling LP Token for Legacy Pool\n');
  console.log(`Pool Address: ${poolAddress}`);
  console.log(`LP Owner: ${lpOwnerAddress}\n`);

  try {
    // Step 1: Get pool reserves from blockchain
    console.log('[1/5] Fetching pool reserves from blockchain...');
    const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);
    const poolAccount = KeetaSDK.lib.Account.fromPublicKeyString(poolAddress);
    const balances = await client.allBalances({ account: poolAccount });

    if (balances.length !== 2) {
      throw new Error(`Expected 2 token balances in pool, found ${balances.length}`);
    }

    const tokenA = balances[0].token.publicKeyString?.toString() ?? balances[0].token.toString();
    const tokenB = balances[1].token.publicKeyString?.toString() ?? balances[1].token.toString();
    const reserveA = BigInt(balances[0].balance ?? 0n);
    const reserveB = BigInt(balances[1].balance ?? 0n);

    console.log(`✅ Token A: ${tokenA.slice(0, 20)}... (${reserveA})`);
    console.log(`✅ Token B: ${tokenB.slice(0, 20)}... (${reserveB})\n`);

    // Step 2: Calculate LP shares using sqrt(reserveA * reserveB)
    console.log('[2/5] Calculating LP shares...');
    const product = reserveA * reserveB;
    const shares = sqrt(product);
    console.log(`✅ LP Shares: ${shares}\n`);

    // Step 3: Create LP token
    console.log('[3/5] Creating LP token on-chain...');
    const lpTokenAddress = await createLPToken(poolAddress, tokenA, tokenB);
    console.log(`✅ LP Token created: ${lpTokenAddress}\n`);

    // Step 4: Mint LP tokens to owner
    console.log('[4/5] Minting LP tokens to owner...');
    await mintLPTokens(lpTokenAddress, lpOwnerAddress, shares);
    console.log(`✅ Minted ${shares} LP tokens to ${lpOwnerAddress}\n`);

    // Step 5: Update .pools.json
    console.log('[5/5] Updating .pools.json...');
    const poolsData = JSON.parse(fs.readFileSync(POOLS_FILE, 'utf8'));

    // Find the pool entry
    let updated = false;
    for (const [key, pool] of Object.entries(poolsData)) {
      if (pool.address === poolAddress) {
        pool.lpTokenAddress = lpTokenAddress;
        updated = true;
        console.log(`✅ Updated pool entry: ${key}`);
        break;
      }
    }

    if (!updated) {
      throw new Error(`Pool ${poolAddress} not found in .pools.json`);
    }

    fs.writeFileSync(POOLS_FILE, JSON.stringify(poolsData, null, 2));
    console.log(`✅ Saved to .pools.json\n`);

    console.log('🎉 LP Token backfill completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Restart the dev server to load the updated pool data');
    console.log('2. Test removing liquidity from this pool');
    console.log('3. Verify LP token balance on-chain\n');

  } catch (err) {
    console.error('\n❌ Backfill failed:');
    console.error(err);
    process.exit(1);
  }
}

backfillLPToken();
