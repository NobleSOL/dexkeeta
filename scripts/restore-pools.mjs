#!/usr/bin/env node
/**
 * Restore pools to .pools.json from known on-chain pools
 * This script discovers LP token addresses and populates the .pools.json cache
 */

import * as KeetaSDK from '@keetanetwork/keetanet-client';
import { CONFIG, getPairKey } from './server/keeta-impl/utils/constants.js';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const KEETA_NETWORK = 'test';

// Known token addresses
const TOKENS = {
  KTA: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
  RIDE: 'keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo',
  WAVE: 'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym',
  TEST: 'keeta_apkuewquwvrain2g7nkgqaobpiqy77qosl52dfheqyhbt4dfozdn5lmzmqh7w',
};

// Known pool addresses from logs
const KNOWN_POOLS = [
  {
    address: 'keeta_athz5k3zcwdkhvbhkso3ac34uhanucgzhd2gn3tfhuahgzaljslostzej2lvm',
    tokenA: TOKENS.WAVE,
    tokenB: TOKENS.KTA,
    name: 'WAVE/KTA',
  },
  {
    address: 'keeta_aqvpd2ear7kby3pjpkvxrkurxk7z2kfv25mcyuqudvzd5xpcz5psup34qnss4',
    tokenA: TOKENS.WAVE,
    tokenB: TOKENS.TEST,
    name: 'WAVE/TEST',
  },
  {
    address: 'keeta_atxpnzkfx5bvjkyfanpuv3uykv2oukx7r44fwfitg4ddqxu3yvleqxq2dsz2',
    tokenA: TOKENS.RIDE,
    tokenB: TOKENS.TEST,
    name: 'RIDE/TEST',
  },
];

async function findLpTokenForPool(client, poolAddress) {
  try {
    // Get account info from blockchain
    const accountsInfo = await client.client.getAccountsInfo([poolAddress]);
    const accountInfo = accountsInfo[poolAddress];

    if (!accountInfo?.info?.name) {
      console.warn(`  ⚠️ No account info for pool ${poolAddress.slice(-8)}`);
      return null;
    }

    // The LP token is stored in the pool's name field
    // Format: "SILVERBACK_POOL|<lpTokenAddress>"
    const parts = accountInfo.info.name.split('|');
    if (parts.length >= 2 && parts[0] === 'SILVERBACK_POOL') {
      return parts[1];
    }

    console.warn(`  ⚠️ Pool name doesn't match expected format: ${accountInfo.info.name}`);
    return null;
  } catch (error) {
    console.error(`  ❌ Error reading pool ${poolAddress.slice(-8)}:`, error.message);
    return null;
  }
}

async function restorePools() {
  console.log('🔧 Restoring pools to .pools.json...\n');

  // Create read-only client
  const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);

  const poolData = {};

  for (const pool of KNOWN_POOLS) {
    console.log(`📍 Processing ${pool.name} pool...`);
    console.log(`   Address: ${pool.address}`);

    // Find LP token address
    const lpTokenAddress = await findLpTokenForPool(client, pool.address);

    if (lpTokenAddress) {
      console.log(`   ✅ LP Token: ${lpTokenAddress}\n`);
    } else {
      console.log(`   ⚠️ No LP token (legacy pool)\n`);
    }

    // Generate pair key (sorted alphabetically)
    const pairKey = getPairKey(pool.tokenA, pool.tokenB);

    // Add to pool data
    poolData[pairKey] = {
      address: pool.address,
      tokenA: pool.tokenA,
      tokenB: pool.tokenB,
      lpTokenAddress: lpTokenAddress || null,
      creator: null, // Will be discovered from on-chain permissions
    };
  }

  // Write to .pools.json
  await fs.writeFile('.pools.json', JSON.stringify(poolData, null, 2));

  console.log('✅ Restored pools to .pools.json');
  console.log(`\nTotal pools restored: ${Object.keys(poolData).length}`);
  console.log('\nNow restart the dev server to load these pools.');
}

restorePools().catch(console.error);
